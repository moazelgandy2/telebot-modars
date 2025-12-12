import express from "express";
import { startBot } from "./src/bot.js";
import config from "./src/config.js";

const app = express();
app.use(express.json());

// Basic Health Check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    config: {
      port: config.port,
    },
  });
});

// Start the Userbot
startBot().catch((err) => {
  console.error("Failed to start Userbot:", err);
});


process.once("SIGINT", () => {
    console.log("Stopping...");
    process.exit(0);
});
process.once("SIGTERM", () => {
    console.log("Stopping...");
    process.exit(0);
});

// Export for serverless (optional) or listen
if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

export default app;
