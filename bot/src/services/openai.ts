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

const systemInstruction = `You are a helpful Teacher Assistant. Speak natural Egyptian Arabic like a friend.

CRITICAL RULES:
1. When user asks about مواعيد/كورسات/جدول → call get_course_info and present data naturally
2. When user asks about عنوان/فين/مكان → call get_locations
3. When user asks about دفع/خصم/سعر → call get_faqs
4. When user asks about رقم/واتساب → call get_contact

VALIDATION: When user asks "في إيه في سنتر X?":
- Call get_course_info first
- Check which courses are actually available in that specific center
- Show ONLY courses available in that center
- Example: "في سنتر الكوربة في أحياء بس" (only Biology in Korba)

TONE:
- Natural: "تمام، دي المواعيد" not "قولّي وانا أكمل معاك"
- Use: "لو محتاج حاجة تانية قولي" not formal phrases
- NEVER use weird symbols like 月 (use ج/شهر)

For greetings, just respond normally without tools.

Greeting: "وعليكم السلام! منور، محتاج إيه؟"`;

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
        "Returns the SCHEDULE (Table/Dates) and Subject details. TRIGGER: 'مواعيد' (Mawa3id), 'جدول' (Gadwal), 'امتى' (Emta), 'حصة' (Hessa), 'فيزياء/عربي/...' (Subjects). EXCLUSION: If user asks 'Where' (فين), do NOT use this.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_locations",
      description:
        "Returns the physical ADDRESS and Map Location. TRIGGER: 'فين' (Fen), 'عنوان' (3enwan), 'مكان' (Makan), 'لوكيشن' (Location), 'السنتر' (The Center). CRITICAL: Do NOT use for 'Mawa3id' (Times).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_faqs",
      description:
        "Returns answers regarding Prices, Payment methods, Discounts, and Systems. TRIGGER: 'بكام' (Bekam), 'مصاريف' (Masareef), 'دفع' (Daf3), 'خصم' (Khasm), 'اونلاين' (Online), 'فلوس' (Money).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_contact",
      description:
        "Returns contact numbers and social links. TRIGGER: 'رقم' (Raqam), 'تليفون' (Telephone), 'واتساب' (WhatsApp), 'ادارة' (Management), 'عايز اكلم حد' (Talk to human).",
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
    ...history.map((msg) => ({
      role: msg.role === "model" ? "assistant" : "user",
      content: msg.parts[0].text,
    })),
  ];

  if (imageUrl && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "user") {
      lastMsg.content = [
        { type: "text", text: lastMsg.content },
        { type: "image_url", image_url: { url: imageUrl } },
      ];
    }
  }

  try {
    const response = await client.chat.completions.create({
      messages: messages as any,
      model: deployment,
      tools: tools,
      reasoning_effort: "none",
      tool_choice: "auto",
      max_completion_tokens: 350,
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
        max_completion_tokens: 600,
        reasoning_effort: "low",
      });

      const finalContent = finalResponse.choices[0].message.content;
      if (!finalContent?.trim()) {
        console.error(
          "Empty final response. Finish reason:",
          finalResponse.choices[0].finish_reason
        );
        return "معلش، في مشكلة في الرد. جرب تاني.";
      }
      return formatForTelegram(finalContent);
    }

    const content = message.content;
    if (!content?.trim()) {
      return "معلش، في مشكلة في الرد. جرب تاني.";
    }
    return formatForTelegram(content);
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return "معلش، السيرفر واقع شوية. 😔";
  }
};
