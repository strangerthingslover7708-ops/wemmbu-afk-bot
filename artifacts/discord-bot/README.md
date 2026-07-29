# Discord Bot

A blank Discord bot project built with [discord.js](https://discord.js.org/) v14 and TypeScript.

## Setup

### 1. Create a Discord Application & Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name, and click **Create**
3. Navigate to the **Bot** tab and click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it
5. Under **Privileged Gateway Intents**, enable **Message Content Intent** (required for reading message content)

### 2. Add the Bot Token as a Secret

In Replit, add your bot token as a secret named `DISCORD_BOT_TOKEN`.

### 3. Invite the Bot to Your Server

1. In the Developer Portal, go to **OAuth2 → URL Generator**
2. Select the `bot` scope
3. Choose the permissions your bot needs (at minimum: **Read Messages/View Channels**, **Send Messages**)
4. Open the generated URL and invite the bot to your server

## Running the Bot

The bot is managed via a workflow. Start it from the **Discord Bot** workflow in Replit.

## Project Structure

```
src/
└── index.ts   ← Main bot entry point
```

## Adding Commands

The `src/index.ts` file includes a simple `!ping` → `Pong!` example. Add your own
`client.on(Events.MessageCreate, ...)` handlers or integrate
[slash commands](https://discordjs.guide/slash-commands/response-methods.html) as needed.
