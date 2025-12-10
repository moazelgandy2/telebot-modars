import { ChatMessage } from "../utils/memory.js";
import { generateResponse as generateOpenAIResponse } from "./openai.js";

export type AIModel = "openai";
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
  return await generateOpenAIResponse(
    history,
    imageUrl,
    sendIntermediateMessage
  );
};
