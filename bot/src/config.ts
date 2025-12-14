import dotenv from "dotenv";
dotenv.config();

export interface Config {
  apiId: number;
  apiHash: string;
  stringSession: string;
  geminiApiKey?: string;
  mistralApiKey?: string;
  openaiApiKey?: string;
  apiBaseUrl: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  port: number;
  reloadPort: number;
  azureOpenAIEndpoint: string;
}

export const config: Config = {
  apiId: parseInt(process.env.API_ID || "0", 10),
  apiHash: process.env.API_HASH || "",
  stringSession: process.env.STRING_SESSION || "",
  geminiApiKey: process.env.GEMINI_API_KEY,
  mistralApiKey: process.env.MISTRAL_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000/api",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  port: parseInt(process.env.PORT || "3000", 10),
  reloadPort: parseInt(process.env.RELOAD_PORT || "4000", 10),
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://chatgptprojapi.services.ai.azure.com/",
};

export default config;
