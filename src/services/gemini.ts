import { GoogleGenAI } from "@google/genai";
import config from "../config.js";

const ai = new GoogleGenAI({
  apiKey: config.geminiApiKey,
});

import { ChatMessage } from "../utils/memory.js";
import fs from "fs";
import path from "path";

// Load course data
const coursesData = JSON.parse(fs.readFileSync(path.resolve("data/courses.json"), "utf-8"));

export const generateResponse = async (history: ChatMessage[], imageUrl?: string): Promise<string> => {
  if (!config.geminiApiKey) {
    return "Gemini API key is missing in configuration.";
  }

  try {
    const model = 'gemini-2.0-flash-lite';
    const configContent = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      systemInstruction: {
        parts: [
          {
            text: `You are a helpful and friendly customer support assistant for a teacher.
            Your name is 'Mosaad' (or whatever fits a helpful Egyptian assistant).

            IMPORTANT RULES:
            1. You must ONLY speak in Egyptian Arabic Slang (العامية المصرية).
            2. Do NOT sound like an AI. Be very human, casual, and polite. Use emojis occasionally.
            3. You answer questions about times, dates, and general course inquiries.
            4. If you don't know something, answer vaguely but politely in Egyptian slang, like "Let me check with the teacher and get back to you" (hashof ma3 el moster w ard 3aleik).
            5. Never break character. Never say "I am a large language model".

            OFFICIAL INFORMATION (Use this to answer questions):
            ${JSON.stringify(coursesData, null, 2)}

            If the user asks about something not in this data (like a different subject), apologize and say you only know about the listed subjects.`,
          },
        ],
      },
    };

    const response = await ai.models.generateContentStream({
      model,
      config: configContent,
      contents: history,
    });

    let fullResponse = "";
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }
    return fullResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm having trouble connecting to my brain right now. Please try again later.";
  }
};
