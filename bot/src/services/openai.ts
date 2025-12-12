import { AzureOpenAI } from "openai";
import { config } from "../config.js";
import { ChatMessage } from "../utils/memory.js";
import {
  getCoursesSummary,
  getPrices,
  getLocationDetails,
  getFAQs,
  getContactInfo,
  searchCourses,
  getCourseById,
  getAllSubjects,
  getAllLevels,
  searchFAQs,
  searchLocations,
  getScheduleSummary,
  getPaymentMethods,
  getBookList
} from "../utils/courseHelpers.js";

// ... (previous code remains same until tools array)

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_course_info",
      description: "Returns all courses with full details: subject, level, centers, online options, schedules, prices, and books. Use for general queries like 'Times', 'Schedule'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_prices",
      description: "Returns all prices from courses, including center, online, and book prices.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_locations",
      description: "Returns all teaching center locations: name, address, map link, and optional working hours.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_faqs",
      description: "Returns all frequently asked questions and their answers.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_contacts",
      description: "Returns contact information: phone, WhatsApp, email, social links, working hours, response time, and payment methods.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_courses",
      description: "Lets users search courses by keyword (subject, level, center, or online platform).",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword e.g. 'Physics', 'Online'" },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_course_by_id",
      description: "Returns details of a specific course by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Course ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_all_subjects",
      description: "Returns a unique list of all subjects available in the DB.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_all_levels",
      description: "Returns a list of all levels available in the DB.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_faqs",
      description: "Searches FAQs by keyword and returns matching Q&A.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Keyword to search in FAQs" },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_locations",
      description: "Searches centers by keyword or location.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Center name or area" },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_schedule_summary",
      description: "Returns all course schedules in a compact summary format.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payment_methods",
      description: "Returns the available payment methods from the contact table.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_book_list",
      description: "Returns all books available for courses with their prices.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

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

### 2. PRICING & DISCOUNT
- **Trigger:** "بكام", "سعر", "مفيش خصم".
- **You:** "يا صديقي الأسعار حالياً لقطة: الشهر بـ 300 جنيه، والترم كله (4 شهور) بـ 1000 جنيه بس (يعني وفرت 200). ها تحب تبدأ؟"
  *(If they insist on discount: "والله ده السعر بعد الخصم يا غالي، والقيمة اللي بناخدها تستاهل أكتر بكتير.")*

### 3. SUBSCRIPTION STEPS (Information)
- **Trigger:** "اشترك ازاي", "ابعت الخطوات", "طريقة الدفع".
- **Response:**
"يا صديقي عشان تنضم للفريق وتبدأ تظبيط فوراً:
1️⃣ حول المبلغ (300 أو 1000) كاش على: 01124145324
2️⃣ املى الاستمارة دي: 🔗 https://forms.gle/8USC1EgQzMYe7Nqo6
3️⃣ ابعتلي هنا (اسكرين التحويل + اسمك).
بس كدة وهضيفك فوراً 🚀"

### 4. CLOSING / CONFIRMATION (Action)
- **Trigger:** "تمام عايز اشترك", "ماشي", "هحول دلوقتي", "يلا بينا".
- **Response:** "على بركة الله يا صديقي 🤝 مستني الاسكرين منك دلوقتي عشان نبدأ فوراً."
  *(Do NOT repeat the steps list here).*

### 5. TECH SUPPORT / OTHER
- **Trigger:** "الموقع واقع", "الفيديو بيقطع".
- **You:** "معلش يا صديقي، تلاقي ضغط على السيرفر. جرب تقلل الجودة لـ 360، ولو لسه بايظ ابعتلي سكرين."

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
  imageUrl?: string,
  sendIntermediateMessage?: (msg: string) => Promise<void>
): Promise<string> => {
  if (!config.openaiApiKey) {
    return "OpenAI API key is missing in configuration.";
  }

  const systemInstruction = await getSystemInstruction();

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
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        if (typeof lastMsg.content === "string") {
            lastMsg.content = [
                { type: "text", text: lastMsg.content },
                { type: "image_url", image_url: { url: imageUrl } },
            ];
        } else if (Array.isArray(lastMsg.content)) {
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
            let args = {};
            try {
                if (toolCall.function.arguments) {
                    args = JSON.parse(toolCall.function.arguments);
                }
            } catch (e) {
                console.error("Error parsing arguments", e);
            }

            switch (toolCall.function.name) {
              case "get_course_info":
                toolResult = await getCoursesSummary();
                break;
              case "get_prices":
                toolResult = await getPrices();
                break;
              case "get_locations":
                toolResult = await getLocationDetails();
                break;
              case "get_faqs":
                toolResult = await getFAQs();
                break;
              case "get_contacts": // Renamed from get_contact to match request
              case "get_contact":  // Fallback
                toolResult = await getContactInfo();
                break;
              case "search_courses":
                toolResult = await searchCourses((args as any).keyword || "");
                break;
              case "get_course_by_id":
                toolResult = await getCourseById((args as any).id || "");
                break;
              case "get_all_subjects":
                toolResult = await getAllSubjects();
                break;
              case "get_all_levels":
                toolResult = await getAllLevels();
                break;
              case "search_faqs":
                toolResult = await searchFAQs((args as any).keyword || "");
                break;
              case "search_locations":
                toolResult = await searchLocations((args as any).keyword || "");
                break;
              case "get_schedule_summary":
                toolResult = await getScheduleSummary();
                break;
              case "get_payment_methods":
                toolResult = await getPaymentMethods();
                break;
              case "get_book_list":
                toolResult = await getBookList();
                break;
              default:
                toolResult = "Unknown tool executed.";
            }

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult,
            });
          }
        }
// ...

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
