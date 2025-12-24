
import dotenv from "dotenv";
dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  adminIds: (process.env.ADMIN_IDS || "").split(",").map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id)),
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000/api",
  reloadPort: process.env.RELOAD_PORT || 4000,
};
