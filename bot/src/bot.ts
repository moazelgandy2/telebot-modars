import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import config from "./config.js";
import { setupCommands } from "./commands/index.js";
import { clearInstructionCache } from "./services/openai.js";
import express from "express";

const app = express();

const fetchSettings = async () => {
    try {
        const res = await fetch(`${config.apiBaseUrl}/settings`);
        const json: any = await res.json();
        if (json.success && json.data) {
            return {
                apiId: Number(json.data.apiId),
                apiHash: json.data.apiHash,
                stringSession: json.data.stringSession
            };
        }
    } catch (e) {
        console.error("Failed to fetch settings from API:", e);
    }
    return null;
};

export let client: TelegramClient | undefined;

export const startBot = async () => {
  console.log("Fetching configuration from DB...");
  const settings = await fetchSettings();

  const apiId = settings?.apiId || config.apiId;
  const apiHash = settings?.apiHash || config.apiHash;
  const session = settings?.stringSession || config.stringSession;

  if (!apiId || !apiHash) {
      console.error("Error: API_ID and API_HASH must be provided (in DB or .env)!");
      return; // Return instead of process.exit to allow retries/reload
  }

  if (!session) {
      console.error("Error: String Session is missing. Waiting for configuration...");
      return;
  }

  const stringSession = new StringSession(session);

  if (client) {
      console.log("Disconnecting old client...");
      await client.disconnect();
      client = undefined;
  }

  client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
  });

  console.log("Connecting to Telegram...");
  try {
      await client.start({
        phoneNumber: async () => "",
        password: async () => "",
        phoneCode: async () => "",
        onError: (err) => console.log(err),
      });
      console.log("Connected directly as Userbot!");

      // Setup event handlers
      setupCommands(client);
  } catch (error) {
      console.error("Failed to connect:", error);
  }
};


app.post("/reload", async (req, res) => {
    console.log("Received reload request. Restarting bot with new settings...");
    clearInstructionCache();
    await startBot();
    res.json({ success: true, message: "Bot restarted and cache cleared" });
});

app.listen(config.reloadPort, () => {
    console.log(`Reload server listening on port ${config.reloadPort}`);
});
