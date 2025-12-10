import express from "express";
import bot from "./src/bot.js";
import config from "./src/config.js";

const app = express();
app.use(express.json());

// Basic Health Check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    config: {
      useWebhook: config.useWebhook,
      port: config.port,
      webhookDomain: config.webhookDomain || null,
    },
  });
});

// Prefer long polling; enable webhook only if explicitly requested
if (config.useWebhook && config.webhookDomain) {
  const webhookPath = "/telegraf";
  app.use(bot.webhookCallback(webhookPath));

  bot.telegram.setWebhook(`${config.webhookDomain}${webhookPath}`).then(() => {
    console.log(`Webhook set to ${config.webhookDomain}${webhookPath}`);
  });
} else {
  bot.launch().then(() => {
    console.log("Bot started in Polling Mode ");
  });
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Export for serverless (optional) or listen
if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

export default app;
