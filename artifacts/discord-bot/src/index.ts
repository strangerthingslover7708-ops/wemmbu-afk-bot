import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";

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

// Map of userId -> original display name (before AFK was set)
const afkUsers = new Map<string, string>();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bots and DMs
  if (message.author.bot) return;
  if (!message.guild || !message.member) return;

  const member = message.member;
  const userId = message.author.id;
  const isOwner = message.guild.ownerId === userId;

  // ── !afk command ────────────────────────────────────────────────────────────
  if (message.content.trim().toLowerCase() === "!afk") {
    if (afkUsers.has(userId)) {
      await message.reply({ content: "You are already AFK.", allowedMentions: { repliedUser: false } });
      return;
    }

    // React with ✅ for everyone
    await message.react("✅");

    const originalName = member.nickname ?? message.author.username;
    afkUsers.set(userId, originalName);

    if (!isOwner) {
      try {
        await member.setNickname(`[AFK] ${originalName}`);
      } catch {
        // Silently skip if nickname change is blocked
      }
    }

    return;
  }

  // ── Restore on next message ──────────────────────────────────────────────────
  if (afkUsers.has(userId)) {
    const originalName = afkUsers.get(userId)!;
    afkUsers.delete(userId);

    if (!isOwner) {
      try {
        // Passing null clears the nickname back to their username
        await member.setNickname(
          originalName === message.author.username ? null : originalName
        );
      } catch {
        // Silently skip if nickname change is blocked
      }
    }

    // Send a welcome-back DM — only visible to them
    try {
      await message.author.send(
        `👋 Welcome back, **${originalName}**! Your AFK status has been removed.`
      );
    } catch {
      // DMs may be disabled — fall back to a brief public reply
      await message.reply({
        content: `👋 Welcome back, **${originalName}**!`,
        allowedMentions: { repliedUser: false },
      });
    }
  }
});

client.login(token);
