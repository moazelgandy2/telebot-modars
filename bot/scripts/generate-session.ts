import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input"; // npm i input
import dotenv from "dotenv";

dotenv.config();

const apiId = parseInt(process.env.API_ID || "", 10);
const apiHash = process.env.API_HASH || "";
const stringSession = new StringSession(""); // Start with empty session

if (!apiId || !apiHash) {
  console.error("Please provide API_ID and API_HASH in .env file");
  process.exit(1);
}

(async () => {
  console.log("Loading interactive client...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () => await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  console.log("You should now be connected.");
  console.log("Here is your session string (save this to your .env file as STRING_SESSION):");
  console.log("\n" + client.session.save() + "\n");

  await client.disconnect();
  process.exit(0);
})();
