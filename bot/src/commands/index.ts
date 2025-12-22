import { TelegramClient, Api } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events/index.js";
import { generateResponse } from "../services/openai.js";
import { logConversation } from "../utils/conversationLogger.js";
import { addToHistory, getHistory, clearHistory } from "../utils/memory.js";
import { uploadMedia, getPDFPageUrls } from "../utils/uploader.js";
import config from "../config.js";
import { findMatchingFAQ } from "../services/faq.js";

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

export const setupCommands = (client: TelegramClient) => {

  client.addEventHandler(async (event: NewMessageEvent) => {
    if (!event.isPrivate) return;
    if (event.message.out) {
        if (event.message.text) {
             const chatId = event.chatId;
             if (chatId) {
                 await addToHistory(Number(chatId), "model", event.message.text);
             }
        }
        return;
    }

    const sender = await event.message.getSender();
    if (sender && 'bot' in sender && sender.bot) return;

    const message = event.message;

    const text = message.text;
    const isPhoto = !!message.media && message.media instanceof Api.MessageMediaPhoto;

    if (text === "/start") {
        const sender = await message.getSender();
        if (sender && 'id' in sender) {
             const senderId = Number(sender.id);
             await clearHistory(senderId);
        }
        await message.reply({ message: "أهلاً! 😊 أنا مساعد الأستاذ. اسألني عن الكورسات والمواعيد والأسعار." });
        return;
    }

    if (text === "/help") {
         await message.reply({ message: "ابعتلي أي سؤال وهرد عليك. استخدم /model لتغيير الذكاء الاصطناعي." });
         return;
    }

    if (text === "/model") {
        await message.reply({ message: "حالياً أنا شغال بنظام OpenAI المطور (ChatGPT) بس 🤖" });
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

    // 2. Handle Media (Photo, Video, Document)
    if (message.media) {
      try {
        const caption = message.text || "";

        // Download media into a Buffer
        const buffer = await client.downloadMedia(message.media, {}) as Buffer;

        if (!buffer) {
             await message.reply({ message: "فشل تحميل الملف. حاول تاني." });
             return;
        }

        // Upload to Cloudinary
        let mediaUrl = "";
        let pdfPageUrls: string[] = [];

        try {
            const uploadResult = await uploadMedia(buffer);
            mediaUrl = uploadResult.secure_url;

            // Check if it's a PDF
            if (uploadResult.format === 'pdf' || mediaUrl.endsWith('.pdf')) {
                 const pageCount = uploadResult.pages || 5;

                 if (pageCount > 5) {
                     await message.reply({ message: "ال PDF كبير شوية، هقرأ أول 5 صفحات بس وهركز فيهم يا بطل 📖" });
                 } else {
                     const processingMessages = [
                        "تمام وصل، ثانية واحدة بقرأه",
                        "وصل يا غالي، هبص عليه وأرد عليك حالاً",
                        "حلو أوي، دقيقة واحدة أقرأ الملف وأقولك",
                        "تمام، سيبني أركز في الملف لحظة وأجيلك",
                        "ماشي، هشوف الملف فيه إيه وأرد عليك علطول",
                        "تمام، بقرأ الملف أهو.. ثواني",
                        "وصلني، ثواني وأكون معاك بالرد"
                     ];
                     const randomMsg = processingMessages[Math.floor(Math.random() * processingMessages.length)];
                     await message.reply({ message: randomMsg });
                 }

                 pdfPageUrls = getPDFPageUrls(uploadResult.public_id, pageCount);
            }

        } catch (uploadError) {
             console.error("Cloudinary upload failed:", uploadError);
             await message.reply({ message: "فشل رفع الملف للسيرفر." });
             return;
        }

        const sender = await message.getSender();
        if (!sender || !('id' in sender)) return;
        const userId = Number(sender.id);
        const { name, username } = getSenderInfo(sender);

        // Construct Attachments Array
        let mimeType = 'document';
        if (mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) mimeType = 'image/jpeg';
        else if (mediaUrl.match(/\.(mp4|webm|mov)$/i)) mimeType = 'video/mp4';
        else if (mediaUrl.endsWith('.pdf') || pdfPageUrls.length > 0) mimeType = 'application/pdf';

        const attachments = [{ url: mediaUrl, type: mimeType }];

        // If PDF pages exist, add them as "virtual" image attachments for the AI to see
        let aiAttachments = [...attachments];
        if (pdfPageUrls.length > 0) {
            aiAttachments = pdfPageUrls.map(url => ({ url, type: 'image/jpeg' }));
        }

        // Log text part AND media URL
        await addToHistory(userId, "user", caption, username, attachments);

        // Check Subscription
        const isSubscribed = await checkSubscription(userId.toString());

        // Pass URL directly to AI
        const history = await getHistory(userId);
        const response = await generateResponse(
            history,
            aiAttachments, // Send page images to AI instead of original PDF url if applicable
            async (msg) => { await message.reply({ message: msg }); },
            isSubscribed,
            userId.toString()
        );

        await message.reply({ message: response });
        await addToHistory(userId, "model", response, username);

        await logConversation(
            userId,
            name,
            `[Attachment: ${mediaUrl}] ${caption}`,
            response
        );

      } catch (error) {
        console.error("Error processing media:", error);
        await message.reply({ message: "حصل مشكلة وأنا بحلل الملف. معلش جرب تاني." });
      }
      return;
    }

    // 3. Handle Text (With Debounce)
    if (text && !text.startsWith("/")) {
        const processAggregatedMessage = async (userId: number, aggregatedText: string, latestEvent: NewMessageEvent) => {
             // Remove from buffer
             messageBuffers.delete(userId.toString());

             try {
                const sender = await latestEvent.message.getSender();
                if (!sender || !('id' in sender)) return;
                const { name, username } = getSenderInfo(sender);

                // Add aggregated text to history
                await addToHistory(userId, "user", aggregatedText, username);

                // Check Subscription
                const isSubscribed = await checkSubscription(userId.toString());
                const history = await getHistory(userId);

                const response = await generateResponse(
                    history,
                    undefined,
                    async (intermediateMsg) => {
                      /* Optional: could enable streaming token updates here if supported */
                    },
                    isSubscribed,
                    userId.toString()
                );

                await latestEvent.message.reply({ message: response });
                await addToHistory(userId, "model", response, username);

                 await logConversation(
                    userId,
                    name,
                    aggregatedText,
                    response
                );

            } catch (error) {
                console.error("Error processing aggregated text:", error);
            }
        };

        const sender = await message.getSender();
        if (!sender || !('id' in sender)) return;
        const userId = Number(sender.id);
        const me = await client.getMe();
        if (sender.id.toString() === me.id.toString()) return;

        // Debounce Logic
        const userIdStr = userId.toString();
        const existing = messageBuffers.get(userIdStr);

        if (existing) {
            clearTimeout(existing.timer);
            const newText = existing.text + "\n" + text;
            messageBuffers.set(userIdStr, {
                text: newText,
                event: event, // update event reference to latest
                timer: setTimeout(() => processAggregatedMessage(userId, newText, event), 2000)
            });
        } else {
            messageBuffers.set(userIdStr, {
                text: text,
                event: event,
                timer: setTimeout(() => processAggregatedMessage(userId, text, event), 2000)
            });
        }
    }

  }, new NewMessage({}));
};
