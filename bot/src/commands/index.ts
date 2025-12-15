import { TelegramClient, Api } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events/index.js";


import { generateResponse } from "../services/openai.js";
import { logConversation } from "../utils/conversationLogger.js";
import { addToHistory, getHistory, clearHistory } from "../utils/memory.js";
import { uploadMedia } from "../utils/uploader.js";
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

export const setupCommands = (client: TelegramClient) => {
  // Handle new messages (Text & Photo)
  client.addEventHandler(async (event: NewMessageEvent) => {
    const message = event.message;
    // Determine if it's text or photo or both
    const text = message.text;
    const isPhoto = !!message.media && message.media instanceof Api.MessageMediaPhoto;

    // 1. Check for commands if it's a text message
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
        try {
            mediaUrl = await uploadMedia(buffer);
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
        // Infer type simple check
        let mimeType = 'document';
        if (mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) mimeType = 'image/jpeg';
        else if (mediaUrl.match(/\.(mp4|webm|mov)$/i)) mimeType = 'video/mp4';

        const attachments = [{ url: mediaUrl, type: mimeType }];

        // Log text part AND media URL
        await addToHistory(userId, "user", caption, username, attachments);

        // Pass URL directly to AI
        const history = await getHistory(userId);
        const response = await generateResponse(
            history,
            attachments,
            async (msg) => { await message.reply({ message: msg }); }
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

    // 3. Handle Text
    if (text && !text.startsWith("/")) {
        try {
            const sender = await message.getSender();
            if (!sender || !('id' in sender)) return;

            // memory.ts expects number, ensuring BigInt id fits or use string if memory.ts supported it.
            // For now assuming it fits in number (safe up to 9 quadrillion).
            const userId = Number(sender.id);
            const { name, username } = getSenderInfo(sender);

            const me = await client.getMe();
            if (sender.id.toString() === me.id.toString()) return;

            // Show typing... (GramJS doesn't have easy sendChatAction like Telegraf in same way, skipping for now)



            await addToHistory(userId, "user", text, username);

            const history = await getHistory(userId);

            const response = await generateResponse(
                history,
                undefined,
                async (intermediateMsg) => {
                  await message.reply({ message: intermediateMsg });
                }
            );

            await message.reply({ message: response });
            await addToHistory(userId, "model", response, username);

             await logConversation(
                userId,
                name,
                text,
                response
            );

        } catch (error) {
            console.error("Error processing text:", error);
        }
    }

  }, new NewMessage({}));
};
