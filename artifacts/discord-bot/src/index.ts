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
  ],
});

// Fired once the client is ready
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
});

// Example: respond to messages
client.on(Events.MessageCreate, (message) => {
  // Ignore messages from bots (including itself)
  if (message.author.bot) return;

  // Simple ping/pong example
  if (message.content === "!ping") {
    message.reply("Pong! 🏓");
  }
});

// Log in to Discord
client.login(token);
