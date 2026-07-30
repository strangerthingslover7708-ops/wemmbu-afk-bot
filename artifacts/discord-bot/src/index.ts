import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is not set. Please add it as a secret.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Map of userId -> { originalName, afkMessage? }
const afkUsers = new Map<string, { originalName: string; afkMessage?: string }>();

// /wemmbu afk set [message]
const command = new SlashCommandBuilder()
  .setName("wemmbu")
  .setDescription("Wemmbu bot commands")
  .addSubcommandGroup((group) =>
    group
      .setName("afk")
      .setDescription("AFK commands")
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Mark yourself as AFK")
          .addStringOption((opt) =>
            opt
              .setName("message")
              .setDescription("Optional message to show while you're AFK")
              .setRequired(false)
          )
      )
  );

// ── Ready ────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);

  const rest = new REST().setToken(token!);

  // Clear any lingering global commands
  await rest.put(Routes.applicationCommands(readyClient.user.id), { body: [] });
  console.log("Completely cleared global slash commands.");

  // Register per-guild (instant, no propagation delay)
  for (const guild of readyClient.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(readyClient.user.id, guild.id), {
        body: [command.toJSON()],
      });
      console.log(`✅ Slash commands registered in guild: ${guild.name}`);
    } catch (err) {
      console.error(`Failed to register commands in guild ${guild.name}:`, err);
    }
  }
});

// ── /wemmbu afk set ───────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) return;

  if (
    interaction.commandName === "wemmbu" &&
    interaction.options.getSubcommandGroup() === "afk" &&
    interaction.options.getSubcommand() === "set"
  ) {
    const userId = interaction.user.id;
    const isOwner = interaction.guild.ownerId === userId;
    const afkMessage = interaction.options.getString("message") ?? undefined;

    if (afkUsers.has(userId)) {
      await interaction.reply({ content: "You are already AFK.", ephemeral: true });
      return;
    }

    // Fetch member so we have the latest data
    const member = await interaction.guild.members.fetch(userId);
    
    // PÅ PRICKEN FIXAT: Hämtar ditt riktiga VISNINGSNAMN (Display Name) istället för användarnamn!
    const originalName = member.displayName;

    afkUsers.set(userId, { originalName, afkMessage });

    // Change nickname for everyone except the server owner
    if (!isOwner) {
      try {
        await member.setNickname(`[AFK] ${originalName}`);
      } catch {
        // Silently skip if blocked by permissions / role hierarchy
      }
    }

    // Letar efter din exakta snygga AFK-roll!
    const afkRole = message.guild.roles.cache.find((r) => r.name === "꧁𓊈𒆜A F K𒆜𓊉꧂");
    if (afkRole) {
      try {
        await member.roles.add(afkRole);
      } catch (err) {
        console.error("Kunde inte lägga till rollen: Kolla så botens roll ligger högre upp än AFK-rollen!", err);
      }
    }

    // Format: No parentheses and no asterisks
    const content = afkMessage
      ? `<@${userId}> is now afk, thank you: ${afkMessage}.`
      : `<@${userId}> is now afk, thank you.`;

    await interaction.reply({ content });
    const sent = await interaction.fetchReply();
    setTimeout(() => sent.delete().catch(() => {}), 10_000);
  }
});

// ── Handle Mentions & Restore on next message ─────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild || !message.member) return;

  const userId = message.author.id;
  const isOwner = message.guild.ownerId === userId;

  // 1. Check if the message tags/pings anyone who is currently AFK
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach((mentionedUser) => {
      // Don't auto-reply if a user accidentally tags themselves
      if (mentionedUser.id === userId) return;

      if (afkUsers.has(mentionedUser.id)) {
        const userData = afkUsers.get(mentionedUser.id);
        
        const responseMessage = userData?.afkMessage 
          ? `this user is afk (${userData.afkMessage})` 
          : "this user is afk";

        message.reply(responseMessage).catch(() => {});
      }
    });
  }

  // 2. Check if the sender themselves is returning from being AFK
  if (!afkUsers.has(userId)) return;

  const userData = afkUsers.get(userId);
  afkUsers.delete(userId); // Instantly remove from database tracking map

  // STEP A: Tar bort din exakta snygga AFK-roll när du skriver!
  const afkRole = message.guild.roles.cache.find((r) => r.name === "꧁𓊈𒆜A F K𒆜𓊉꧂");
  if (afkRole) {
    try {
      await message.member.roles.remove(afkRole);
    } catch (err) {
      console.error("Failed to remove role automatically:", err);
    }
  }

  // STEP B: Send the Welcome Back chat message right away
  try {
    const welcomeMsg = await message.channel.send(`welcome back <@${userId}> ur now off afk`);
    setTimeout(() => welcomeMsg.delete().catch(() => {}), 10_000);
  } catch {
    try {
      if (userData) {
        await message.author.send(`welcome back ${userData.originalName} ur now off afk`);
      }
    } catch {}
  }

  // STEP C: Try to change nickname last (Safely isolated to protect server owners)
  if (!isOwner && userData) {
    try {
      await message.member.setNickname(
        userData.originalName === message.author.username ? null : userData.originalName
      );
    } catch {
      // Silently catch role hierarchy permission blockages
    }
  }
});

client.login(token);
