import express from "express";
import bot from "./src/bot.js";
import config from "./src/config.js";

const app = express();
app.use(express.json());

// Basic Health Check
app.get("/", (req, res) => {
  res.send("Telebot is running 🤖");
});

// Webhook handling
if (config.webhookDomain) {
  const webhookPath = "/telegraf";
  app.use(bot.webhookCallback(webhookPath));

  // Set webhook automagically
  bot.telegram.setWebhook(`${config.webhookDomain}${webhookPath}`).then(() => {
    console.log(`Webhook set to ${config.webhookDomain}${webhookPath}`);
  });
} else {
  // Long Polling (Dev mode)
  bot.launch().then(() => {
    console.log("Bot started in Polling Mode 🚀");
  });
}

// Graceful Stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Export for serverless (optional) or listen
if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

export default app;
