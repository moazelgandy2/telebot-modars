import { Mistral } from "@mistralai/mistralai";
import { config } from "../config.js";
import { ChatMessage } from "../utils/memory.js";
import fs from "fs";
import path from "path";

// Load course data for context
const coursesData = JSON.parse(fs.readFileSync(path.resolve("data/courses.json"), "utf-8"));

const systemInstruction = `You are 'Mosaad', a professional, friendly, and helpful assistant for a teacher.

*** CRITICAL RULES (DO NOT IGNORE) ***
1. **MODEL**: You are currently running on Mistral Medium. Be smart and precise.
2. **LANGUAGE**: Speak confident, natural Egyptian Arabic.
   - **Tone**: "In the middle". Not too formal (Fusha), but not too slangy/street. Be respectful.
   - Use "Hadretak" with strangers, "Ya basha" occasionally.

3. **FORMATTING**:
   - **NO MARKDOWN**: Do not use bold (**text**), italics, or headers.
   - **NO LONG LISTS**: Write in simple, short paragraphs.

4. **PRECISION (MOST IMPORTANT)**:
   - **Answer ONLY what is asked**.
   - If asked for **Price** -> Give ONLY the price. Do NOT list times/locations.
   - If asked for **Time** -> Give ONLY the time.
   - If asked for **Location** -> Give ONLY the location.
   - Do NOT dump all the course info.

*** CONVERSATION EXAMPLES ***
User: "Salam"
Mosaad: "Wa 3aleikom el salam. Ezay hadretak? A2morny b eh?"

User: "Be kam physics 3 sec?"
Mosaad: "El physics le talta thanawy b 300 geneh f el shahr online, w 100 geneh lel hessa f el center."

User: "Mwa3id el physics emta?"
Mosaad: "Feh mwa3id yom el 7ad el sa3a 10 sob7 f Nasr City, w yom el 2arba3 el sa3a 4 3asr."

*** COURSE DATA ***
${JSON.stringify(coursesData, null, 2)}
`;

const fallbackSystemInstruction = `You are 'Mosaad', a smart Admin for a specialized tutoring center.

*** YOUR DATA (READ THIS CAREFULLY) ***
${JSON.stringify(coursesData, null, 2)}
****************************************

*** INSTRUCTIONS ***
1. **ROLE**: You answer questions about the COURSES above.
2. **CONTEXT**: If user asks "Schedules" (Mawa3id), LOOK at the data and ask "For which subject?" (Mada eh?) or list them briefly.
   - NEVER ask "What topics?" (Mawadi3). Say "Mada" (Subject).
3. **LANGUAGE**: Egyptian Slang ONLY. (Ezayak, Ya Basha, M3ak).
4. **FORMAT**: text only. NO MARKDOWN.

If you don't find the answer in the DATA, say "Ma3lesh, msh 3aref."`;


const client = new Mistral({ apiKey: config.mistralApiKey });

export const generateResponse = async (history: ChatMessage[], imageUrl?: string): Promise<string> => {
  if (imageUrl) {
      return "Ma3lesh, Mistral (Medium) can't see images yet. Try /model openai or /model gemini.";
  }
  if (!config.mistralApiKey) {
    return "Mistral API key is missing in configuration.";
  }

  // Default messages for Medium
  const messages = [
    { role: "system", content: systemInstruction },
    ...history.map((msg) => ({
      role: msg.role === "model" ? "assistant" : "user",
      content: msg.parts[0].text,
    })),
  ];

  try {
    const chatResponse = await client.chat.complete({
      model: "mistral-medium-latest",
      messages: messages as any,
    });
    return chatResponse.choices?.[0].message.content as string || "Ma3lesh, feh moshkela. Jarab tany.";

  } catch (error: any) {
    console.error("Mistral API Error (Medium):", error.message);

    // Check for Rate Limit (429) or other transient errors
    if (error.statusCode === 429 || error.message?.includes("429")) {
        console.log("Hit rate limit on Medium. Retrying with Small...");

        try {
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Use specialized instructions for Small
            const fallbackMessages = [
                { role: "system", content: fallbackSystemInstruction },
                ...history.map((msg) => ({
                  role: msg.role === "model" ? "assistant" : "user",
                  content: msg.parts[0].text,
                })),
            ];

            // Fallback to Small model
            const fallbackResponse = await client.chat.complete({
                model: "mistral-small-latest",
                messages: fallbackMessages as any,
            });

            const content = fallbackResponse.choices?.[0].message.content as string;
            // Ensure we don't fix what isn't broken, but add the note
            return content + "\n\n(Replied using Mistral Small due to high traffic 🚦)";
        } catch (retryError) {
             console.error("Mistral API Error (Small Fallback):", retryError);
             return "Ma3lesh, el server wa2e3 shwaya (Traffic 3aly). 😔";
        }
    }

    return "Ma3lesh, el server wa2e3 shwaya. 😔";
  }
};
