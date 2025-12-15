
import { config } from "../config.js";
import { client, deployment } from "./openai.js";

interface FAQ {
    id: string;
    question: string;
    answer: string;
}

let cachedFAQs: FAQ[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000 * 5; // 5 minutes cache


export const getFAQs = async (): Promise<FAQ[]> => {
    const now = Date.now();
    if (cachedFAQs && (now - lastFetchTime < CACHE_TTL)) {
        return cachedFAQs;
    }

    try {
        console.log("[Bot] Fetching FAQs from API...");
        const res = await fetch(`${config.apiBaseUrl}/faqs`);
        const json: any = await res.json();
        if (json.success && Array.isArray(json.data)) {
            console.log(`[Bot] Fetched ${json.data.length} FAQs.`);
            cachedFAQs = json.data;
            lastFetchTime = now;
            return cachedFAQs!;
        }
    } catch (e) {
        console.error("Failed to fetch FAQs:", e);
    }

    return cachedFAQs || [];
};

export const findMatchingFAQ = async (userQuestion: string): Promise<string | null> => {
    console.log(`[FAQ] Search requested for: "${userQuestion}"`);
    const faqs = await getFAQs();
    if (faqs.length === 0) {
        console.log("[FAQ] No FAQs available to search.");
        return null;
    }


    // 1. Semantic Match using LLM (Search in all FAQs)
    // We pass all questions to the LLM to find the best match.
    const questionsList = faqs.map((f, i) => `${i + 1}. ${f.question} (Answer: ${f.answer.substring(0, 50)}...)`).join("\n");

    const prompt = `

You are a helpful assistant searching for an answer in a FAQ database.
Here is the list of Frequently Asked Questions (FAQ):
${questionsList}

User Query: "${userQuestion}"

Task: Identify which FAQ provides the best answer to the User Query.
- If a relevant FAQ is found, reply with its NUMBER ONLY (e.g. "1").
- If the user query is unrelated to any of these FAQs, reply "NO".
`;

    try {
        const completion = await client.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: deployment,
            max_completion_tokens: 10,
        });

        const content = completion.choices[0].message.content?.trim();
        console.log(`[FAQ] LLM Response: "${content}"`);
        if (content && content !== "NO") {
             const index = parseInt(content);
             if (!isNaN(index) && index > 0 && index <= faqs.length) {
                 const match = faqs[index - 1];
                 console.log(`[FAQ] Match found: [${index}] ${match.question}`);
                 return match.answer;
             }
        }
    } catch (e) {
        console.error("Error in semantic matching:", e);
    }

    console.log("[FAQ] No match found.");
    return null;
}
