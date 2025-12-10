import { ChatMessage } from "../utils/memory.js";
import { generateResponse as generateGeminiResponse } from "./gemini.js";
import { generateResponse as generateMistralResponse } from "./mistral.js";
import { generateResponse as generateOpenAIResponse } from "./openai.js";

export type AIModel = "gemini" | "mistral" | "openai";
export let currentModel: AIModel = "openai";

export const setGlobalModel = (model: AIModel) => {
  currentModel = model;
  console.log(`Global AI model switched to: ${model}`);
};

export const getGlobalModel = () => {
  return currentModel;
};

export const generateResponse = async (
  history: ChatMessage[],
  imageUrl?: string,
  sendIntermediateMessage?: (msg: string) => Promise<void>
): Promise<string> => {
  switch (currentModel) {
    case "mistral":
      return await generateMistralResponse(history, imageUrl);
    case "openai":
      return await generateOpenAIResponse(
        history,
        imageUrl,
        sendIntermediateMessage
      );
    case "gemini":
    default:
      return await generateGeminiResponse(history, imageUrl);
  }
};
