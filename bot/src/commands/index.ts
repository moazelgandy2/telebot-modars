import { TelegramClient, Api } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events/index.js";
  generateResponse,
} from "../services/openai.js";
import { logConversation } from "../utils/conversationLogger.js";
import { addToHistory, getHistory, clearHistory } from "../utils/memory.js";
import { uploadImage } from "../utils/uploader.js";

const getSenderName = (sender: any): string => {
   let name = "Unknown";
   if ('firstName' in sender && sender.firstName) {
       name = sender.firstName;
   } else if ('title' in sender && sender.title) {
       name = sender.title;
   }
   if ('username' in sender && sender.username) {
       name += ` (@${sender.username})`;
   }
   return name;
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

    // 2. Handle Photo
    if (isPhoto) {
      try {
        const caption = message.text || "";

        // Download media into a Buffer
        const buffer = await client.downloadMedia(message.media!, {}) as Buffer;

        if (!buffer) {
             await message.reply({ message: "فشل تحميل الصورة. حاول تاني." });
             return;
        }

        // Upload to Cloudinary
        let imageUrl = "";
        try {
            imageUrl = await uploadImage(buffer);
        } catch (uploadError) {
             console.error("Cloudinary upload failed:", uploadError);
             await message.reply({ message: "فشل رفع الصورة للسيرفر. تأكد من الإعدادات." });
             return;
        }

        const sender = await message.getSender();
        if (!sender || !('id' in sender)) return;
        const userId = Number(sender.id);

        // Log text part AND image URL
        await addToHistory(userId, "user", caption, imageUrl);

        // Pass URL directly to AI
        const history = await getHistory(userId);
        const response = await generateResponse(
            history,
            imageUrl, // Pass the URL here
            async (msg) => { await message.reply({ message: msg }); }
        );

        await message.reply({ message: response });
        await addToHistory(userId, "model", response);

        await logConversation(
            userId,
            getSenderName(sender),
            `[Image: ${imageUrl}] ${caption}`,
            response
        );

      } catch (error) {
        console.error("Error processing photo:", error);
        await message.reply({ message: "حصل مشكلة وأنا بحلل الصورة. معلش جرب تاني." });
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

            const me = await client.getMe();
            if (sender.id.toString() === me.id.toString()) return;

            // Show typing... (GramJS doesn't have easy sendChatAction like Telegraf in same way, skipping for now)

            await addToHistory(userId, "user", text);
            const history = await getHistory(userId);

            const response = await generateResponse(
                history,
                undefined,
                async (intermediateMsg) => {
                  await message.reply({ message: intermediateMsg });
                }
            );

            await message.reply({ message: response });
            await addToHistory(userId, "model", response);

             await logConversation(
                userId,
                getSenderName(sender),
                text,
                response
            );

        } catch (error) {
            console.error("Error processing text:", error);
        }
    }

  }, new NewMessage({}));
};
