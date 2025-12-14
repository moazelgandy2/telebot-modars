import { AzureOpenAI } from "openai";
import { config } from "../config.js";
import { ChatMessage } from "../utils/memory.js";

const formatForTelegram = (text: string): string => {
  return text.trim();
};


const FALLBACK_INSTRUCTION = `You are **Moaz's Admin**, a Mentor & Accountability Partner (Not a Teacher) for Thanaweya Amma students.

## 🎭 PERSONA & TONE
- **Role:** Your "Big Brother" who organizes your life.
- **Tone:** Natural Egyptian Slang (عامية), Warm, Supportive.
- **Addressing:** Use **"يا صديقي"** (My friend) 95% of the time.
- **Vibe:** Short, fast, like a WhatsApp chat.

## 🚫 STRICT BOUNDARIES
1. **NO TEACHING:** You do **NOT** explain lessons.
   - If asked: "يا صديقي أنا هنا بنظملك وقتك وبتابعك، لكن مش بشرح المناهج. قولي المادة دي واخدة منك وقت قد ايه ونظبطها في الجدول؟"
2. **NO ROBOTIC LISTS:** Never say "Choose option 1 or 2".
3. **SHORT INPUTS:** If user sends "." or "hi" -> Say **ONLY**: "منور يا صديقي، اؤمرني؟"

## 🧠 RESPONSE STRATEGY

### 1. "DETAILS" / "WHAT DO YOU DO?"
- **Trigger:** "تفاصيل", "بتعملوا ايه".
- **You:** "يا صديقي احنا تيم كامل بنظملك وقتك وبنعملك جداول تلم بيها المنهج، ومعاك مكالمة كل أسبوع ومتابعة يومية عشان متكسلش. يعني بنشيل هم التنظيم من عليك."

### 2. SUBSCRIPTION STEPS (Information)
- **Trigger:** "اشترك ازاي", "ابعت الخطوات", "طريقة الدفع".
- **Response:**
"يا صديقي عشان تنضم للفريق وتبدأ تظبيط فوراً:
1️⃣ حول المبلغ (300 أو 1000) كاش على: 01124145324
2️⃣ املى الاستمارة دي: 🔗 https://forms.gle/8USC1EgQzMYe7Nqo6
3️⃣ ابعتلي هنا (اسكرين التحويل + اسمك).
بس كدة وهضيفك فوراً 🚀"

### 3. CLOSING / CONFIRMATION (Action)
- **Trigger:** "تمام عايز اشترك", "ماشي", "هحول دلوقتي", "يلا بينا".
- **Response:** "على بركة الله يا صديقي 🤝 مستني الاسكرين منك دلوقتي عشان نبدأ فوراً."
  *(Do NOT repeat the steps list here).*

## 🧪 CHECKS BEFORE SENDING
- Did they say "Tamam" or "Mashy"? -> **Use CLOSING response.**
- Did they say "How to subscribe"? -> **Use SUBSCRIPTION STEPS.**
- Did I explain a lesson? -> **STOP.** Say "I only organize."
`;

let cachedInstruction: string | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

const getSystemInstruction = async (): Promise<string> => {
  const now = Date.now();
  if (cachedInstruction && (now - lastFetchTime < CACHE_TTL)) {
    return cachedInstruction;
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}/system-instruction`);
    const data: any = await response.json();
    if (data.success && data.data?.content) {
        cachedInstruction = data.data.content;
        lastFetchTime = now;
        return cachedInstruction!;
    }
  } catch (error) {
    console.error("Failed to fetch system instruction:", error);
  }

  if (cachedInstruction) return cachedInstruction;

  // Fallback to default instruction if everything fails
  return FALLBACK_INSTRUCTION;
};




const endpoint = "https://chatgptprojapi.services.ai.azure.com/";
const apiVersion = "2024-08-01-preview";
const deployment = "gpt-5-nano";

const client = new AzureOpenAI({
  endpoint: endpoint,
  apiKey: config.openaiApiKey,
  apiVersion: apiVersion,
  deployment: deployment,
});

export const generateResponse = async (
  history: ChatMessage[],
  attachments?: { url: string; type: string }[],
  sendIntermediateMessage?: (msg: string) => Promise<void>
): Promise<string> => {
  if (!config.openaiApiKey) {
    return "OpenAI API key is missing in configuration.";
  }

  const systemInstruction = await getSystemInstruction();

  const messages: any[] = [
    { role: "system", content: systemInstruction },
    ...history.map((msg) => {
        // Handle history items (assuming we might start storing attachments in history in the future in a compatible way)
        const parts = msg.parts || []; // Safely handle parts
        const content = parts.map((part: any) => {
          if (part.image_url) {
              return { type: "image_url", image_url: { url: part.image_url.url } };
          }
          // Check specifically for string (even empty) to avoid dropping empty text blocks which are valid anchors
          if (typeof part.text === 'string') {
              return { type: "text", text: part.text };
          }
          return null;
        }).filter(Boolean);

        // Fallback: If content is empty (e.g. some malformed message), provide placeholder to prevent API error
        if (content.length === 0) {
             return null; // We will filter these out
        }

        return {
            role: msg.role === "model" ? "assistant" : "user",
            content: content,
        };
    }).filter(Boolean) as any[], // Filter out null messages
  ];

  if (attachments && attachments.length > 0) {
    // Check if we have a user message pending (the last one usually, but here we are constructing the NEW message)
    // Actually, generateResponse is called *after* addToHistory in the current flow?
    // No, looking at commands/index.ts:
    // await addToHistory(...)
    // const history = await getHistory(...)
    // const response = await generateResponse(history, ...)

    // So 'history' already contains the latest user message.
    // We need to attach the images to that last message in the 'messages' array we just built.

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
          let contentArray: any[] = [];

          // If existing content is string, convert to array
          if (typeof lastMsg.content === "string") {
              contentArray.push({ type: "text", text: lastMsg.content });
          } else if (Array.isArray(lastMsg.content)) {
              contentArray = [...lastMsg.content];
          }

          // Append new attachments
          attachments.forEach(att => {
              if (att.type.startsWith('image/')) {
                   // Ensure we don't duplicate if history already had it (unlikely with this flow but safe)
                   // Actually history logic in memory.ts is just returning {text, imageUrl} single field.
                   // So we DO need to inject the extra attachments here if they aren't in the simplified history yet.
                   contentArray.push({ type: "image_url", image_url: { url: att.url } });
              } else {
                  // For non-images, append to text
                  const textPart = contentArray.find(c => c.type === "text");
                  if (textPart) {
                      textPart.text += `\n[Attachment: ${att.type} - ${att.url}]`;
                  } else {
                      contentArray.push({ type: "text", text: `[Attachment: ${att.type} - ${att.url}]` });
                  }
              }
          });

          lastMsg.content = contentArray;
      }
    }
  }

  let retries = 0;
  while (retries >= 0) {
    try {
      const response = await client.chat.completions.create({
        messages: messages as any,
        model: deployment,
        // tools: tools, // No tools needed
        reasoning_effort: "none",
        // tool_choice: "auto",
        max_completion_tokens: 800,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Removed tool handling block

      const content = message.content;
      if (!content?.trim()) {
        throw new Error("Empty content");
      }
      return formatForTelegram(content);
    } catch (error: any) {
      console.error(`Attempt failed. Retries left: ${retries}`, error);

      // Handle Image Error (400 Bad Request: image url can not be accessed)
      if (error?.status === 400 && error?.error?.message?.includes("image")) {
          console.warn("Image access failed. Retrying without images...");

          // Strip images from messages
          messages.forEach(m => {
              if (Array.isArray(m.content)) {
                  m.content = m.content
                    .filter((c: any) => c.type === "text")
                    .map((c: any) => c.text)
                    .join("\n") + "\n[Image was here but expired]";
              }
          });

          // Retry immediately without decrementing generic retries too much, or just continue loop
          // We modified 'messages' in place, so next loop iteration uses text-only messages.
          continue;
      }

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
