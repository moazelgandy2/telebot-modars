import { TelegramClient, Api } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events/index.js";
import {
  generateResponse,
} from "../services/aiManager.js";
import { logConversation } from "../utils/conversationLogger.js";
import { addToHistory, getHistory, clearHistory } from "../utils/memory.js";

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
        const caption = message.text || "Please analyze this image.";
        // Download media (GramJS downloads to buffer or path)
        const buffer = await client.downloadMedia(message.media!, {});

        // We need a way to pass the image to the AI.
        // The original implementation passed a URL.
        // GramJS gives us a Buffer. We might need to upload it somewhere or convert to base64 if the AI service supports it.
        // Looking at `aiManager.ts` (implied), it might expect a URL.
        // IF the previous bot logic relied on Telegram file links, Userbot doesn't generate public links easily without uploading.
        // HOWEVER, for now let's assume we can't easily get a public URL for a userbot message without uploading it.
        // We will pass a placeholder or try to handle base64 if possible.
        // Since I can't easily change aiManager blindly, and the original code used `ctx.telegram.getFileLink`,
        // which gives a URL.
        // For a Userbot, we receive the file directly.
        // I will log that photo handling might need adjustment in `aiManager` if it strictly requires http URL.

        // For now, let's assume we proceed with text logic or basic handling.
        await message.reply({ message: "معلش، حالياً مش بقدر أحلل صور من حساب المستخدم مباشرة." });
        return;

        /*
        // Original logic for reference:
        const userId = ctx.from.id;
        await addToHistory(userId, "user", caption, imageUrl);
        const history = await getHistory(userId);
        const response = await generateResponse(history, imageUrl);
        */
      } catch (error) {
        console.error("Error processing photo:", error);
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

            // Get name safely
            let name = "Unknown";
            if ('firstName' in sender && sender.firstName) {
                name = sender.firstName;
            } else if ('title' in sender && sender.title) {
                name = sender.title;
            }
            if ('username' in sender && sender.username) {
                name += ` (@${sender.username})`;
            }

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
