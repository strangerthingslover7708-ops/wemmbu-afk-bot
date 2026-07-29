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
  console.log("🧹 Cleared global slash commands.");

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

    // Fetch member so we have the latest nickname
    const member = await interaction.guild.members.fetch(userId);
    const originalName = member.nickname ?? interaction.user.username;

    afkUsers.set(userId, { originalName, afkMessage });

    // Change nickname for everyone except the server owner
    if (!isOwner) {
      try {
        await member.setNickname(`[AFK] ${originalName}`);
      } catch {
        // Silently skip if blocked by permissions / role hierarchy
      }
    }

    // Assign the AFK role if it exists
    const afkRole = interaction.guild.roles.cache.find((r) => r.name === "AFK");
    if (afkRole) {
      try {
        await member.roles.add(afkRole);
      } catch {
        // Silently skip if bot lacks Manage Roles permission
      }
    }

    // Public confirmation — tags the user, auto-deleted after 10 seconds
    const content = afkMessage
      ? `<@${userId}> is now afk, thank you. *(${afkMessage})*`
      : `<@${userId}> is now afk, thank you.`;

    await interaction.reply({ content });
    const sent = await interaction.fetchReply();
    setTimeout(() => sent.delete().catch(() => {}), 10_000);
  }
});

// ── Restore on next message ───────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild || !message.member) return;

  const userId = message.author.id;
  const isOwner = message.guild.ownerId === userId;

  if (!afkUsers.has(userId)) return;

  const { originalName } = afkUsers.get(userId)!;
  afkUsers.delete(userId);

  // Restore nickname
  if (!isOwner) {
    try {
      await message.member.setNickname(
        originalName === message.author.username ? null : originalName
      );
    } catch {
      // Silently skip
    }
  }

  // Remove the AFK role if it exists
  const afkRole = message.guild.roles.cache.find((r) => r.name === "AFK");
  if (afkRole) {
    try {
      await message.member.roles.remove(afkRole);
    } catch (err) {
      console.error("Failed to remove AFK role:", err);
    }
  }

  // Welcome back — public message tagging them, auto-deleted after 10 seconds
  try {
    const welcomeMsg = await message.channel.send(`welcome back <@${userId}> ur now off afk`);
    setTimeout(() => welcomeMsg.delete().catch((err) => console.error("Failed to delete welcome msg:", err)), 10_000);
  } catch (err) {
    console.error("Failed to send welcome back message:", err);
  }
});

client.login(token);
