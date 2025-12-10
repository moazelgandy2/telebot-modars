import dotenv from "dotenv";
dotenv.config();

export interface Config {
  botToken: string;
  geminiApiKey?: string;
  mistralApiKey?: string;
  openaiApiKey?: string;
  apiBaseUrl: string;
  webhookDomain?: string;
  port: number;
}

export const config: Config = {
  botToken: process.env.BOT_TOKEN || "",
  geminiApiKey: process.env.GEMINI_API_KEY,
  mistralApiKey: process.env.MISTRAL_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000/api",
  webhookDomain: process.env.WEBHOOK_DOMAIN,
  port: parseInt(process.env.PORT || "3000", 10),
};

export default config;
