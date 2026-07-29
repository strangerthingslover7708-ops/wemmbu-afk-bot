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
  // Ignore bots
  if (message.author.bot) return;
  // Only works in servers (not DMs)
  if (!message.guild || !message.member) return;

  const member = message.member;
  const userId = message.author.id;

  // --- !afk command ---
  if (message.content.trim().toLowerCase() === "!afk") {
    // Avoid double-AFK
    if (afkUsers.has(userId)) {
      await message.reply("You are already AFK.");
      return;
    }

    // Always react with a checkmark, regardless of role
    await message.react("✅");

    const originalName = member.nickname ?? message.author.username;
    afkUsers.set(userId, originalName);

    const isOwner = message.guild.ownerId === userId;

    if (isOwner) {
      // Server owner: skip nickname change to avoid permission error
      await message.reply(`You are now AFK, **${originalName}**. (Nickname change skipped — server owners cannot have their nickname changed by bots.)`);
    } else {
      try {
        await member.setNickname(`[AFK] ${originalName}`);
        await message.reply(`You are now AFK, **${originalName}**. Your nickname has been updated.`);
      } catch {
        await message.reply(
          `You are now AFK, **${originalName}**. (Could not update your nickname — make sure the bot has the **Manage Nicknames** permission and that your role is below the bot's role.)`
        );
      }
    }
    return;
  }

  // --- Auto-restore on any other message while AFK ---
  if (afkUsers.has(userId)) {
    const originalName = afkUsers.get(userId)!;
    afkUsers.delete(userId);

    try {
      // Restore to original nickname (null clears the nickname, reverting to username)
      await member.setNickname(originalName === message.author.username ? null : originalName);
      await message.reply(`Welcome back, **${originalName}**! Your AFK status has been removed.`);
    } catch {
      await message.reply(`Welcome back, **${originalName}**! (Could not restore your nickname — check bot permissions.)`);
    }
  }
});

client.login(token);
