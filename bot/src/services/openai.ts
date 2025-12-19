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


  return FALLBACK_INSTRUCTION;
};

export const clearInstructionCache = () => {
    cachedInstruction = null;
    lastFetchTime = 0;
    console.log("System instruction cache cleared.");
};




const endpoint = config.azureOpenAIEndpoint;
const apiVersion = "2024-08-01-preview";

export const deployment = "gpt-5-nano";


export const client = new AzureOpenAI({
  endpoint: endpoint,
  apiKey: config.openaiApiKey,
  apiVersion: apiVersion,
  deployment: deployment,
});



export const generateResponse = async (
  history: ChatMessage[],
  attachments?: { url: string; type: string }[],
  sendIntermediateMessage?: (msg: string) => Promise<void>,
  telegramId?: string
): Promise<string> => {
  if (!config.openaiApiKey) {
    return "OpenAI API key is missing in configuration.";
  }

  const systemInstruction = await getSystemInstruction();

  const { getFAQs } = await import("./faq.js");
  const faqs = await getFAQs();

  let knowledgeBase = "\n\n## 📚 KNOWLEDGE BASE (FAQs)\n";
  if (faqs.length === 0) {
      knowledgeBase += "No FAQs available currently.";
  } else {
    knowledgeBase += faqs.map((f, i) => `${i+1}. ${f.question}?\n${f.answer}`).join("\n");
  }

  const enhancedSystemInstruction = systemInstruction + knowledgeBase;
  console.log(`[DEBUG] System Instruction Length: ${enhancedSystemInstruction.length}`);

  const recentHistory = history.slice(-20);

  const messages: any[] = [
    { role: "system", content: enhancedSystemInstruction },
    ...recentHistory.map((msg) => {
        const parts = msg.parts || [];
        const content = parts.map((part: any) => {
          if (part.image_url) {
              return { type: "image_url", image_url: { url: part.image_url.url } };
          }
          if (typeof part.text === 'string') {
              return { type: "text", text: part.text };
          }
          return null;
        }).filter(Boolean);

        if (content.length === 0) return null;

        return {
            role: msg.role === "model" ? "assistant" : "user",
            content: content,
        };
    }).filter(Boolean) as any[],
  ];

  if (attachments && attachments.length > 0) {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
          let contentArray: any[] = [];
          if (typeof lastMsg.content === "string") {
              contentArray.push({ type: "text", text: lastMsg.content });
          } else if (Array.isArray(lastMsg.content)) {
              contentArray = [...lastMsg.content];
          }

          attachments.forEach(att => {
              if (att.type.startsWith('image/')) {
                   contentArray.push({ type: "image_url", image_url: { url: att.url } });
              } else {
                  const textPart = contentArray.find(c => c.type === "text");
                  if (textPart) {
                      textPart.text += `\n[Attachment: ${att.type} - ${att.url}]`;
                  } else {
                      contentArray.push({ type: "text", text: `\n[Attachment: ${att.type} - ${att.url}]` });
                  }
              }
          });
          lastMsg.content = contentArray;
      }
    }
  }

  const tools: any[] = [
      {
          type: "function",
          function: {
              name: "check_sub",
              description: "Checks if the user is subscribed to the premium study follow-up service. Call this BEFORE answering any academic or study-related questions.",
              parameters: {
                  type: "object",
                  properties: {}, // No params needed as we use the context telegramId, but we can verify
              },
          },
      },
  ];

  let retries = 0;
  while (retries >= 0) {
    try {
      console.log(`[DEBUG] Sending request to OpenAI with ${messages.length} messages.`);

      const response = await client.chat.completions.create({
        messages: messages as any,
        model: deployment,
        tools: tools,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Handle Tool Calls
      if (message.tool_calls && message.tool_calls.length > 0) {
           const toolCall = message.tool_calls[0] as any;
           if (toolCall.function.name === "check_sub") {
               console.log("[DEBUG] Tool call: check_sub");

               let isSubscribed = false;
               if (telegramId) {
                   try {
                       const res = await fetch(`${config.apiBaseUrl}/subscription?userId=${telegramId}`);
                       const json: any = await res.json();
                       if (json.success && json.isSubscribed) {
                           isSubscribed = true;
                       }
                   } catch (e) {
                       console.error("Failed to check subscription:", e);
                   }
               }

               const toolResult = isSubscribed ? "true" : "false";
               console.log(`[DEBUG] check_sub result: ${toolResult}`);

               messages.push(message); // Add assistant's tool call message
               messages.push({
                   role: "tool",
                   tool_call_id: toolCall.id,
                   content: toolResult,
               });

               // Recursively call again with tool result
               const followUpResponse = await client.chat.completions.create({
                   messages: messages as any,
                   model: deployment,
               });

               const followUpContent = followUpResponse.choices[0].message.content;
                if (!followUpContent?.trim()) {
                     return "معلش، النظام مشغول. ممكن تجرب تاني؟";
                }
               return formatForTelegram(followUpContent);
           }
      }

      const content = message.content;
      if (!content?.trim()) {
        console.warn("Received empty content from OpenAI.");
        return "معلش، حصل مشكلة بسيطة. ممكن تكرر السؤال؟";
      }
      return formatForTelegram(content);

    } catch (error: any) {
      console.error(`Attempt failed. Retries left: ${retries}`, error);
      // ... (existing retry logic for images could be kept or simplified)
       if (error?.status === 400 && error?.error?.message?.includes("image")) {
          console.warn("Image access failed. Retrying without images...");
          messages.forEach(m => {
              if (Array.isArray(m.content)) {
                  m.content = m.content
                    .filter((c: any) => c.type === "text")
                    .map((c: any) => c.text)
                    .join("\n") + "\n[Image was here but expired]";
              }
          });
          continue;
      }

      retries--;
      if (retries < 0) {
        return "معلش، الشبكة بتعلق شوية. ثانية واحدة وهجرب أرد عليك تاني... 🔄";
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return "معلش، النظام مشغول جداً دلوقتي. ممكن دقيقة واحدة؟";
};
