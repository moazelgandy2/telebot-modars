import { AzureOpenAI } from "openai";
import { config } from "../config.js";
import { ChatMessage } from "../utils/memory.js";
import {
  getCoursesSummary,
  getContactInfo,
  getFAQs,
  getLocationDetails,
} from "../utils/courseHelpers.js";

const formatForTelegram = (text: string): string => {
  return text
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .replace(/  +/g, " ") // Remove extra spaces
    .replace(/(📌[^\n]+)\n-/g, "$1\n\n-") // Space after headers
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
};

const systemInstruction = `You are Telebot Assistant (مساعد تلي بوت).
## CORE RULE: NO QUESTIONS. NO CONFIRMATION.
- **Goal**: Give the answer IMMEDIATELY in a scannable format.
- **Forbidden**: "Do you mean...?", "Which one?", "I will send you...".
- **REQUIRED**: Start directly with the data. "Here are the schedules:".

## formatting Rules (STRICT Output)
- **TRANSLATE TO ARABIC**: The tools return data in English (e.g., "Sat", "Sun", "1st Sec", "Physics"). You **MUST TRANSLATE** these to Arabic (e.g., "السبت", "الأحد", "أولى ثانوي", "فيزياء"). NEVER output English words for days/grades.
- **Group by Subject**: Group data to be scannable.
  - **فيزياء**:
    - أولى: سبت 5م - 100ج
    - ثانية: أحد 3م - 120ج

## Logic & Flow
- **No Hallucinated Greetings**: If user says "Salam", just reply to the greeting. DO NOT offer data yet.
- **No Echoing**: Do not repeat the question.
- **Vision Logic**: If user sends an image of a problem/question, **SOLVE IT**. Do not give generic advice. Assume role of a Physics/Math Tutor for that specific turn.

## Dialect
- Polite Egyptian Arabic (عامية مهذبة).
- Titles: "يا فندم".
- Symbol Ban: NEVER use \`月\`. Use \`شهر\`.

## Tool Triggers (Smart)
  - If user asks about "Physics", SHOW ALL PHYSICS DATA. Do not ask "Which level?". Show ALL of them.
  - If user asks about "Center", SHOW ALL CENTERS. Do not ask "Which center?".
  - If user asks about "Times", SHOW ALL TIMES for the context you have.
  - IF YOU CALL A TOOL, PRINT THE RESULT IMMEDIATELY.
  - **NEVER** ask the user to clarify before showing data. Show the data FIRST, then ask if they need more.
  - **Expand, Don't Repeat**: If user asks "More details" (تفاصيل اكتر), DO NOT repeat the schedule. Show **Prices** or **Location Maps**.

## Dialect
- Polite Egyptian Arabic (عامية مهذبة).
- Titles: "يا فندم".
- Symbol Ban: NEVER use \`月\`. Use \`شهر\`.

## Tool Triggers (Smart)
1. Schedule/Subjects -> \`get_course_info\`
2. Address/Location -> \`get_locations\`
3. Price/Cost/Online -> \`get_faqs\`
4. Phone/Contact -> \`get_contact\`
5. "More details" -> Call \`get_faqs\` AND \`get_locations\` together.

## Examples
User: "مواعيد الفيزياء"
Assistant: [Calls get_course_info] -> "دي كل مواعيد الفيزياء:
- فيزياء (أولى): سبت 5م
- فيزياء (ثانوية): أحد 3م
أي خدمة تانية؟"

User: "تفاصيل اكتر"
Assistant: [Calls get_faqs + get_locations] -> "بالنسبة للمصاريف والعنوان:
- السعر: 350ج/شهر
- المكان: سنتر الكوربة (اللوكيشن: ...)"`;

const endpoint = "https://chatgptprojapi.services.ai.azure.com/";
const apiVersion = "2024-08-01-preview";
const deployment = "gpt-5-nano";

const client = new AzureOpenAI({
  endpoint: endpoint,
  apiKey: config.openaiApiKey,
  apiVersion: apiVersion,
  deployment: deployment,
});

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_course_info",
      description:
        "Fetches COURSE SCHEDULES, SUBJECTS, and TEACHERS. Use this when the user asks about: 'Dates' (مواعيد), 'Schedule' (جدول), 'Classes' (حصة), or specific subjects like 'Physics' (فيزياء), 'Arabic' (عربي). DO NOT use for general location questions.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_locations",
      description:
        "Fetches PHYSICAL ADDRESSES and GOOGLE MAPS LINKS. Use this when the user asks: 'Where' (فين), 'Address' (عنوان), 'Location' (لوكيشن), 'Center' (السنتر).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_faqs",
      description:
        "Fetches PRICING, DISCOUNTS, ONLINE SYSTEMS, and PAYMENT DETAILS. Use this when the user asks: 'Price' (بكام/سعر), 'Cost' (مصاريف), 'Online' (أونلاين), 'Payment' (دفع), 'Discount' (خصم).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_contact",
      description:
        "Fetches PHONE NUMBERS, SOCIAL LINKS, and ADMIN CONTACTS. Use this when the user asks: 'Number' (رقم), 'Phone' (تليفون), 'WhatsApp' (واتساب), 'Management' (إدارة), 'Human' (عايز اكلم حد).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

export const generateResponse = async (
  history: ChatMessage[],
  imageUrl?: string,
  sendIntermediateMessage?: (msg: string) => Promise<void>
): Promise<string> => {
  if (!config.openaiApiKey) {
    return "OpenAI API key is missing in configuration.";
  }

  const messages: any[] = [
    { role: "system", content: systemInstruction },
    ...history.map((msg) => {
      const part = msg.parts[0] as any;
      if (part.imageUrl) {
        return {
          role: msg.role === "model" ? "assistant" : "user",
          content: [
            { type: "text", text: part.text },
            { type: "image_url", image_url: { url: part.imageUrl } },
          ],
        };
      }
      return {
        role: msg.role === "model" ? "assistant" : "user",
        content: part.text,
      };
    }),
  ];

  if (imageUrl) {
    // If imageUrl is provided for the current turn, append it to the last user message
    // Note: The caller (commands/ts) likely added the text part to history already
    // but the imageUrl argument is passed separately.
    // However, if we saved it to history with imageUrl, it might be duplicated if we blindly add it again.
    // But commands/ts adds to history BEFORE calling generateResponse.
    // Let's check commands/ts.
    // commands/ts: await addToHistory(userId, "user", caption); <--- No imageUrl yet
    // So the history contains only text.
    // So we MUST attach the imageUrl to the last message here.

    // Wait, if I update commands/ts to save imageUrl, then history WILL have it.
    // So "imageUrl" arg might become redundant if we reload history.
    // But for now, let's keep the logic:
    // If the last message in history is a user string (no image yet), attach it.

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        if (typeof lastMsg.content === "string") {
            lastMsg.content = [
                { type: "text", text: lastMsg.content },
                { type: "image_url", image_url: { url: imageUrl } },
            ];
        } else if (Array.isArray(lastMsg.content)) {
            // Check if image already exists
            const hasImage = lastMsg.content.some((c: any) => c.type === "image_url" && c.image_url?.url === imageUrl);
            if (!hasImage) {
                 lastMsg.content.push({ type: "image_url", image_url: { url: imageUrl } });
            }
        }
      }
    }
  }

  let retries = 0;
  while (retries >= 0) {
    try {
      const response = await client.chat.completions.create({
        messages: messages as any,
        model: deployment,
        tools: tools,
        reasoning_effort: "none",
        tool_choice: "auto",
        max_completion_tokens: 800,
      });

      const choice = response.choices[0];
      const message = choice.message;

      if (message.tool_calls) {
        // Send loading message with variety
        if (sendIntermediateMessage) {
          const msgs = ["لحظة... ⏳", "خليني أشيك 🔍", "ثانية واحدة ⏱️"];
          await sendIntermediateMessage(
            msgs[Math.floor(Math.random() * msgs.length)]
          );
        }

        messages.push(message);

        for (const toolCall of message.tool_calls) {
          if (toolCall.type === "function") {
            let toolResult = "";

            switch (toolCall.function.name) {
              case "get_course_info":
                toolResult = await getCoursesSummary();
                break;
              case "get_contact":
                toolResult = await getContactInfo();
                break;
              case "get_faqs":
                toolResult = await getFAQs();
                break;
              case "get_locations":
                toolResult = await getLocationDetails();
                break;
            }

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }
        }

        const finalResponse = await client.chat.completions.create({
          messages: messages as any,
          model: deployment,
          max_completion_tokens: 800,
          reasoning_effort: "low",
        });

        const finalContent = finalResponse.choices[0].message.content;
        if (!finalContent?.trim()) {
          throw new Error("Empty final response");
        }
        return formatForTelegram(finalContent);
      }

      const content = message.content;
      if (!content?.trim()) {
        throw new Error("Empty content");
      }
      return formatForTelegram(content);
    } catch (error) {
      console.error(`Attempt failed. Retries left: ${retries}`, error);
      retries--;
      if (retries < 0) {
        return "معلش، الشبكة بتعلق شوية. ثانية واحدة وهجرب أرد عليك تاني... 🔄";
      }
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return "معلش، النظام مشغول جداً دلوقتي. ممكن دقيقة واحدة؟";
};
