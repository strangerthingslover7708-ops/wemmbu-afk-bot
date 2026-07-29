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

  // Register slash commands globally
  const rest = new REST().setToken(token!);
  try {
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: [command.toJSON()],
    });
    console.log("✅ Slash commands registered globally.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
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

    // Public confirmation — no ping, friendly message
    const content = afkMessage
      ? `${originalName} is now afk, thank you. *(${afkMessage})*`
      : `${originalName} is now afk, thank you.`;

    await interaction.reply({ content });
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

  // Welcome back — DM so only they see it; fall back to a quiet public reply
  try {
    await message.author.send(`welcome back ${originalName} ur now off afk`);
  } catch {
    await message.reply({
      content: `welcome back ${originalName} ur now off afk`,
      allowedMentions: { repliedUser: false },
    });
  }
});

client.login(token);
