import { AzureOpenAI } from "openai";
import { config } from "../config.js";
import { ChatMessage } from "../utils/memory.js";

const formatForTelegram = (text: string): string => {
  return text.trim();
};


const FALLBACK_INSTRUCTION = `# ROLE: Team Rehla Admin (Senior Student, "Big Brother").
## IDENTITY
- **Tone:** Egyptian Ammiya (عامية), chill, supportive. NO corporate/formal speak.
- **Address:** "يا صديقي" ONLY.
- **Format:** Max 2-3 short sentences. NO lists/bullets. Use ".." separators.

## TOOLS
- \`send_reaction(emoji)\`: Use on "Ok/Thanks/Done" to end chat. STOP text generation.

## RULES
1. **ACADEMIC:**
   - Active Sub: Answer immediately (1-2 lines).
   - Free Sub: Refuse ("معلش الشرح للمشتركين.. تفاصيل؟").
2. **SCHEDULE:**
   - Edit: "بلغت الإدارة وهنرد عليك."
   - Lazy: Advice ("ذاكر مادتين 50/10 دقيقة").
3. **SOCIAL:**
   - Voice: "اكتبلي مش عارف اسمع."
   - Late (1AM-5AM): "سهران ليه؟ ذاكر ونام."
   - Hype: "ايه الحلاوة دي!" (No selling).
4. **BOUNDARIES:**
   - Competitors: "كلهم خير وبركة، ركز معانا."
   - Tech: "بلغت الدعم."
   - Identity: "احنا تيم كامل."
   - Safety: Warn on login codes.

## SCRIPTS (Use Exact)
1. **PITCH** ("تفاصيل"): "🎓 نظام رحلة تالتة ثانوي:\nجدول + متابعة + دكاترة 24/7.\n300ج شهري / 1000ج ترم كامل 🔥"
2. **ACTION** ("اشترك"): "يلا بينا 🫡\n1️⃣ كاش: \`01124145324\`\n2️⃣ سجل: https://forms.gle/8USC1EgQzMYe7Nqo6\n3️⃣ ابعتلي اسكرين."
3. **HOURS** ("مواعيد"): "يومياً 8ص لـ 11م."
4. **PRICE** ("خصم"): "السعر ثابت، الأوفر ترم كامل."

## EMOJI MAPPING (STRICT DIVERSITY)
- **Love/Thanks:** ❤️ (e.g. "شكراً", "بحبك")
- **Funny/Joke:** 😂 (e.g. "ههههه", meme)
- **Achievement/Hype:** 🔥 (e.g. "قفلت الامتحان")
- **Encouragement:** 👏 (e.g. "قربت تخلص")
- **Agreement:** 👍 (e.g. "تمام", "ماشي")
- **Reaction Rule:** Do NOT default to 🔥. Match the context!

## INTENT ANALYSIS (CRITICAL)
Before solving, determine intent:
- **SHARING (Progress/Achievement):** Replying with praise/hype ONLY. Do NOT explain/solve. (e.g. "عاش يا بطل! استمر 🔥").
- **ASKING (Question/Problem):** Solve and explain normally.`;

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

const tools: any[] = [
    {
        type: "function",
        function: {
            name: "send_reaction",
            description: "Send an emoji reaction to the user message to acknowledge or close the conversation without text.",
            parameters: {
                type: "object",
                properties: {
                    emoji: {
                        type: "string",
                        description: "The emoji to react with (e.g. ❤️, 🔥, 👍, 😂)",
                        enum: ["❤️", "🔥", "👍", "😂", "👏"]
                    }
                },
                required: ["emoji"]
            }
        }
    }
];

import { updateSession } from "../utils/memory.js";

// ... (other imports)

// Separate Summarization Logic
const performSummarization = async (userId: string, history: ChatMessage[], currentSummary?: string, currentMetadata?: any) => {
    console.log(`[Memory] Triggering summarization for ${userId}...`);
    try {
        const recent = history.slice(-20); // Summarize last 20 messages
        // We only want text
        const conversationText = recent.map(m => `${m.role}: ${m.parts.map(p => p.text).join(" ")}`).join("\n");

        const prompt = `
        You are an expert memory assistant.
        Refine the following summary and user profile based on the new conversation.

        Current Summary: ${currentSummary || "None"}
        Current Profile: ${JSON.stringify(currentMetadata || {})}

        New Conversation:
        ${conversationText}

        Output a JSON object with:
        1. "summary": A concise, running summary of the conversation history (keep important facts, discard chit-chat).
        2. "profile": Updated user profile (extract name, grade, interests, etc.). Merge with current.

        JSON ONLY.
        `;

        const response = await client.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: deployment, // Use the same deployment
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (content) {
            const result = JSON.parse(content);
            console.log(`[Memory] Updated for ${userId}:`, result);
            await updateSession(userId, { summary: result.summary, metadata: result.profile });
        }
    } catch (e) {
        console.error("[Memory] Summarization failed:", e);
    }
};

export const generateResponse = async (
  history: ChatMessage[],
  attachments?: { url: string; type: string }[],
  sendIntermediateMessage?: (msg: string) => Promise<void>,
  isSubscribed?: boolean,
  userId?: string,
  onReaction?: (emoji: string) => Promise<void>,
  summary?: string,
  metadata?: any
): Promise<string> => {
  if (!config.openaiApiKey) {
    return "OpenAI API key is missing in configuration.";
  }

  // Trigger Background Summarization everyday 10 messages
  if (userId && history.length > 0 && history.length % 10 === 0) {
      // Fire and forget
      performSummarization(userId, history, summary, metadata).catch(e => console.error(e));
  }

  const systemInstruction = await getSystemInstruction();
  const { getFAQs } = await import("./faq.js");
  const faqs = await getFAQs();

  let knowledgeBase = "\n\n## 📚 KNOWLEDGE BASE (FAQs)\n";
  if (faqs.length === 0) knowledgeBase += "No FAQs available currently.";
  else knowledgeBase += faqs.map((f, i) => `${i+1}. ${f.question}?\n${f.answer}`).join("\n");

  // Inject User Context with Timestamp (Optimization)
  const nowStr = new Date().toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

  let memoryContext = "";
  if (summary) memoryContext += `\n\n## 🧠 MEMORY SUMMARY:\n${summary}`;
  if (metadata && Object.keys(metadata).length > 0) memoryContext += `\n\n## 👤 USER PROFILE:\n${JSON.stringify(metadata, null, 2)}`;

  const userContext = `\n\n[USER CONTEXT]\nTime: ${nowStr}\nSubscription Status: ${isSubscribed ? "ACTIVE (PREMIUM)" : "INACTIVE (FREE)"}\nUser ID: ${userId || "Unknown"}`;

  const enhancedSystemInstruction = systemInstruction + knowledgeBase + memoryContext + userContext;

  const recentHistory = history.slice(-100);
  const messages: any[] = [
    { role: "system", content: enhancedSystemInstruction },
    ...recentHistory.map((msg) => {
        const parts = msg.parts || [];
        const content = parts.map((part: any) => {
          if (part.image_url) return { type: "image_url", image_url: { url: part.image_url.url } };
          if (typeof part.text === 'string') return { type: "text", text: part.text };
          return null;
        }).filter(Boolean);
        if (content.length === 0) return null;
        return { role: (msg.role === "model" || msg.role === "assistant") ? "assistant" : "user", content: content };
    }).filter(Boolean),
  ];

  // Attachments Handling
  if (attachments && attachments.length > 0) {
      if (messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role === "user") {
               if (typeof lastMsg.content === "string") lastMsg.content = [{ type: "text", text: lastMsg.content }];
               else if (!Array.isArray(lastMsg.content)) lastMsg.content = [];

                attachments.forEach(att => {
                    if (att.type.startsWith('image/')) lastMsg.content.push({ type: "image_url", image_url: { url: att.url } });
                    else lastMsg.content.push({ type: "text", text: `\n[Attachment: ${att.type} - ${att.url}]` });
                });
          }
      }
  }

  let retries = 0;
  while (retries >= 0) {
    try {
      console.log(`[DEBUG] Sending request to OpenAI with ${messages.length} messages.`);
      const response = await client.chat.completions.create({
        messages: messages as any,
        model: deployment,
        tools: tools,
        tool_choice: "auto"
      });

      const message = response.choices[0].message;

      // Handle Tool Calls
      if (message.tool_calls) {
          messages.push(message); // Add assistant's tool call message
          let reactionSent = false;

          for (const toolCall of message.tool_calls) {
              const tc = toolCall as any;
              const fnName = tc.function.name;
              const args = JSON.parse(tc.function.arguments);
              let result = "";

              if (fnName === "send_reaction") {
                  if (onReaction) {
                      await onReaction(args.emoji);
                      result = "Reaction sent successfully. Conversation closed.";
                      reactionSent = true;
                  } else {
                      result = "Reaction tool not supported in this context.";
                  }
              }

              messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result
              });
          }

          // If we reacted, stop here and return empty (Silent).
          // We don't need to call the model again if the intent was just to react.
          if (reactionSent) return "";

          // Re-run model to get final response
          const secondResponse = await client.chat.completions.create({
            messages: messages as any,
            model: deployment
          });
          const content = secondResponse.choices[0].message.content;
           if (content) return formatForTelegram(content);
           return ""; // Empty string if it decided to stop
      }

      const content = message.content;
      if (!content?.trim()) {
           // If we just reacted, empty content is fine.
           // How do we know if we reacted? We don't trace it here unless we check history.
           // But standard empty content check logic:
           return "";
      }
      return formatForTelegram(content);

    } catch (error: any) {
       console.error(`Attempt failed.`, error);
       retries--;
       if (retries < 0) return "معلش، حصل مشكلة في الشبكة. 🔄";
       await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return "Error";
};
