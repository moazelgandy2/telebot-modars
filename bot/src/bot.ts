import { Telegraf } from "telegraf";
import config from "./config.js";
import { logger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { setupCommands } from "./commands/index.js";

if (!config.botToken) {
  throw new Error("BOT_TOKEN must be provided!");
}

const bot = new Telegraf(config.botToken);

// Middleware
bot.use(logger);

// Error Handling
bot.catch(errorHandler);

// Commands
setupCommands(bot);

export default bot;
