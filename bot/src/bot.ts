import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import config from "./config.js";
import { setupCommands } from "./commands/index.js";

if (!config.apiId || !config.apiHash) {
  throw new Error("API_ID and API_HASH must be provided in .env!");
}

if (!config.stringSession) {
  console.error("Error: STRING_SESSION is missing in .env.");
  console.error("Please run 'npx tsx scripts/generate-session.ts' to generate a session string.");
  process.exit(1);
}

const stringSession = new StringSession(config.stringSession);

export const client = new TelegramClient(stringSession, config.apiId, config.apiHash, {
  connectionRetries: 5,
});

// Initialize logic
export const startBot = async () => {
  console.log("Connecting to Telegram...");
  await client.start({
    phoneNumber: async () => "", // Not needed if session is present
    password: async () => "",
    phoneCode: async () => "",
    onError: (err) => console.log(err),
  });
  console.log("Connected directly as Userbot!");

  // Setup event handlers
  setupCommands(client);
};

export default client;
