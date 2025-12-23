import { TelegramClient, Api } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events/index.js";
import { generateResponse } from "../services/openai.js";
import { logConversation } from "../utils/conversationLogger.js";
import { addToHistory, getHistory, clearHistory } from "../utils/memory.js";
import { uploadMedia, getPDFPageUrls } from "../utils/uploader.js";
import config from "../config.js";
import { findMatchingFAQ } from "../services/faq.js";
import { isBotActive, getReplyTarget, isWithinWorkingHours } from "../utils/settings.js";

const getSenderInfo = (sender: any) => {
   let name = "Unknown";
   let username = undefined;

   if (sender.username) {
       username = `@${sender.username}`;
   }

   if (sender.firstName) {
       name = sender.firstName;
   } else if (sender.title) {
       name = sender.title;
   }

   if (username) {
       name += ` (${username})`;
   }

   return { name, username: sender.username || undefined };
};

// Helper to check subscription
const checkSubscription = async (userId: string): Promise<boolean> => {
    try {
        const res = await fetch(`${config.apiBaseUrl}/subscription?userId=${userId}`);
        const json: any = await res.json();
        return json.success && json.isSubscribed;
    } catch (e) {
        console.error("Failed to check subscription:", e);
        return false;
    }
};

// Message Buffer Types
interface BufferState {
  text: string;
  timer: NodeJS.Timeout;
  event: NewMessageEvent; // Keep last event to reply to
}
const messageBuffers = new Map<string, BufferState>();

// Media Buffer Types
interface MediaItem {
    buffer: Buffer;
    caption: string;
    type: 'photo' | 'document';
    filename?: string;
}
interface MediaBufferState {
    items: MediaItem[];
    timer: NodeJS.Timeout;
    event: NewMessageEvent;
}
const mediaBuffers = new Map<string, MediaBufferState>();

const userTyping = new Map<string, number>();

// --- Process Aggregated Text ---
const processAggregatedMessage = async (client: TelegramClient, userId: string, aggregatedText: string, latestEvent: NewMessageEvent) => {
    messageBuffers.delete(userId);

    try {
        const sender = await latestEvent.message.getSender();
        const { name, username } = getSenderInfo(sender);

        // Check if FAQ matches
        const faqAnswer = await findMatchingFAQ(aggregatedText);
        if (faqAnswer) {
            await latestEvent.message.reply({ message: faqAnswer });
            await addToHistory(userId, "user", aggregatedText, username);
            await addToHistory(userId, "model", faqAnswer, username);
            await logConversation(userId, name, aggregatedText, faqAnswer);
            return;
        }

        // Add aggregated text to history
        await addToHistory(userId, "user", aggregatedText, username);

        // Check Subscription
        const isSubscribed = await checkSubscription(userId.toString());
        const history = await getHistory(userId);

        const response = await generateResponse(
            history,
            undefined,
            async (intermediateMsg) => {},
            isSubscribed,
            userId.toString(),
            async (emoji) => {
                try {
                    await client.invoke(new Api.messages.SendReaction({
                        peer: sender,
                        msgId: latestEvent.message.id,
                        reaction: [new Api.ReactionEmoji({ emoticon: emoji })]
                    }));
                } catch(e) { console.error("Reaction failed:", e); }
            }
        );

        if (response) {
            await latestEvent.message.reply({ message: response });
            await addToHistory(userId, "model", response, username);
            await logConversation(userId, name, aggregatedText, response);
        } else {
            await addToHistory(userId, "model", "[Reaction Sent]", username);
            await logConversation(userId, name, aggregatedText, "[Reaction Sent]");
        }

    } catch (error) {
        console.error("Error processing aggregated text:", error);
    }
};

// --- Process Aggregated Media ---
const processAggregatedMedia = async (client: TelegramClient, userId: string, state: MediaBufferState) => {
    const { items, event } = state;
    mediaBuffers.delete(userId);

    if (items.length === 0) return;

    try {
        const sender = await event.message.getSender();
        const { name, username } = getSenderInfo(sender);

        // Notify user block removed for silent processing


        const attachments: { url: string; type: string }[] = [];
        let combinedCaption = "";

        // 1. Upload Loop
        for (const item of items) {
            if (item.caption) combinedCaption += item.caption + "\n";
            try {
                const uploadResult = await uploadMedia(item.buffer);

                // If PDF, get pages
                if (uploadResult.format === 'pdf' || item.filename?.endsWith('.pdf')) {
                    const pageUrls = getPDFPageUrls(uploadResult.public_id, uploadResult.pages || 5);
                    pageUrls.forEach(url => attachments.push({ url, type: "image/pdf_page" }));
                } else {
                    // Normal Image/Video
                    attachments.push({ url: uploadResult.secure_url, type: uploadResult.resource_type || "image" });
                }
            } catch (e) {
                console.error("Upload failed for item:", e);
            }
        }

        // 2. Generate Response
        // Add user caption to history first
        const userPrompt = combinedCaption.trim() || "[Media Message]";
        await addToHistory(userId, "user", userPrompt, username);

        const isSubscribed = await checkSubscription(userId.toString());
        const history = await getHistory(userId);

        const response = await generateResponse(
            history,
            attachments, // Pass all URLs
            undefined,
            isSubscribed,
            userId.toString(),
            async (emoji) => {
                try {
                    await client.invoke(new Api.messages.SendReaction({
                        peer: sender,
                        msgId: event.message.id,
                        reaction: [new Api.ReactionEmoji({ emoticon: emoji })]
                    }));
                } catch(e) { console.error("Reaction failed:", e); }
            }
        );

        if (response) {
            await event.message.reply({ message: response });
            await addToHistory(userId, "model", response, username);
            await logConversation(userId, name, `[${items.length} Attachments] ${userPrompt}`, response);
        } else {
             await addToHistory(userId, "model", "[Reaction Sent]", username);
             await logConversation(userId, name, `[${items.length} Attachments] ${userPrompt}`, "[Reaction Sent]");
        }

    } catch (e) {
        console.error("Error processing aggregated media:", e);
        await event.message.reply({ message: "معلش حصل مشكلة في معالجة الصور. جرب تاني." });
    }
};


export const setupCommands = (client: TelegramClient) => {

  // Raw Event Handler for Typing Status
  client.addEventHandler((update: any) => {
      // Check for Private Chat Typing
      if (update instanceof Api.UpdateUserTyping) {
           const userId = update.userId.toString();
           userTyping.set(userId, Date.now() + 6000); // 6s expiry

           // EXTEND TEXT DEBOUNCE
           const buffer = messageBuffers.get(userId);
           if (buffer) {
               clearTimeout(buffer.timer);
               buffer.timer = setTimeout(() => processAggregatedMessage(client, userId, buffer.text, buffer.event), 2500);
           }
      }
  });

  client.addEventHandler(async (event: NewMessageEvent) => {
    if (!event.isPrivate) return;

    // Handle Outgoing (Admin replies)
    if (event.message.out) {
        if (event.message.text) {
             const chatId = event.chatId;
             if (chatId) {
                 await addToHistory(chatId.toString(), "assistant", event.message.text);
             }
        }
        return;
    }

    const message = event.message;
    const sender = await message.getSender();
    if (!sender) return;
    const userId = sender.id!.toString();

    // --- GLOBAL BOT CONTROLS ---
    // 1. Master Switch
    const isActive = await isBotActive();
    if (!isActive) return; // Silent Ignore

    // 2. Subscription Filter
    const replyTarget = await getReplyTarget();
    if (replyTarget === 'subscribers') {
        const isSub = await checkSubscription(userId);
        if (!isSub) return; // Silent Ignore
    }

    // 3. Working Hours
    const isOpen = await isWithinWorkingHours();
    if (!isOpen) {
         console.log(`[Working Hours] Ignored message from ${userId} (Outside Working Hours).`);
         return; // Silent Ignore
    }
    // ---------------------------

    // Ignore other bots and Telegram Service
    if (sender && 'bot' in sender && sender.bot) return;
    if (sender && 'id' in sender && (sender.id.toString() === "777000" || sender.id.toString() === "42777")) return;


    // Command Handling
    const text = message.text || "";
    if (text === "/start") {
        await clearHistory(userId);
        await message.reply({ message: "أهلاً! 😊 أنا مساعد الأستاذ. اسألني عن الكورسات والمواعيد والأسعار." });
        return;
    }
    if (text === "/help") {
         await message.reply({ message: "ابعتلي أي سؤال وهرد عليك. استخدم /model لتغيير الذكاء الاصطناعي." });
         return;
    }
    if (text === "/reload") {
        await message.reply({ message: "جاري تحديث النظام والإعدادات... ⏳" });
        try {
            await fetch(`http://localhost:${config.reloadPort}/reload`, { method: "POST" });
            await message.reply({ message: "تم التحديث بنجاح! 🚀" });
        } catch (e) {
            console.error("Reload failed:", e);
            await message.reply({ message: "فشل التحديث. تأكد ان السيرفر شغال." });
        }
        return;
    }

    // --- Media Handling (Aggregated) ---
    if (message.media && !(message.media instanceof Api.MessageMediaWebPage)) {
        // Skip WebPage previews, handle Photos/Documents
        try {
            const buffer = await client.downloadMedia(message.media, {}) as Buffer;
            if (!buffer) return;

            const caption = message.text || "";
            const isPhoto = message.media instanceof Api.MessageMediaPhoto;

            // Get or Create Buffer
            let mediaState = mediaBuffers.get(userId);
            if (!mediaState) {
                mediaState = { items: [], timer: setTimeout(() => {}, 0), event: event };
                mediaBuffers.set(userId, mediaState);
            }

            // Add Item
            mediaState.items.push({
                buffer,
                caption,
                type: isPhoto ? 'photo' : 'document',
                filename: 'documentAttribute' in message.media ? (message.media.documentAttribute as any)?.filename : undefined
            });
            mediaState.event = event; // Update latest event

            // Reset Timer (Wait 4s for more photos in album)
            clearTimeout(mediaState.timer);
            mediaState.timer = setTimeout(() => {
                const s = mediaBuffers.get(userId);
                if (s) processAggregatedMedia(client, userId, s);
            }, 3500);

            return; // STOP here, don't process as text
        } catch (e) {
            console.error("Media download error:", e);
        }
    }


    // --- Text Handling (Aggregated) ---
    if (text && !text.startsWith("/")) {
        // Debounce Logic
        const userIdStr = userId.toString();
        const existing = messageBuffers.get(userIdStr);

        // Adaptive Debounce Strategy
        const calculateDelay = (txt: string) => {
            if (txt.length < 15) return 3500;
            if (txt.length < 50) return 2500;
            return 1500;
        };

        if (existing) {
            // Cancel previous timer
            clearTimeout(existing.timer);
            // Append text
            existing.text += `\n${text}`;
            existing.event = event; // Update reference to reply to latest
            // Set new timer
            const delay = calculateDelay(text);
            existing.timer = setTimeout(() => processAggregatedMessage(client, userId, existing.text, existing.event), delay);
        } else {
            // New Buffer
            const delay = calculateDelay(text);
            const state: BufferState = {
                text: text,
                timer: setTimeout(() => processAggregatedMessage(client, userId, text, event), delay),
                event: event
            };
            messageBuffers.set(userIdStr, state);
        }
    }

  }, new NewMessage({}));
};
