import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import {
  generateResponse,
  setGlobalModel,
  getGlobalModel,
} from "../services/aiManager.js";
import { logConversation } from "../utils/conversationLogger.js";
import { addToHistory, getHistory, clearHistory } from "../utils/memory.js";

// Buffer for debouncing messages
const userBuffers = new Map<
  number,
  { lines: string[]; timeout: NodeJS.Timeout; ctx: Context }
>();

const processBufferedMessages = async (userId: number) => {
  const buffer = userBuffers.get(userId);
  if (!buffer) return;

  userBuffers.delete(userId); // Clear buffer
  const { lines, ctx } = buffer;
  const combinedMessage = lines.join("\n");

  try {
    // Add user message to memory
    await addToHistory(userId, "user", combinedMessage);

    // Get full history for context
    const history = await getHistory(userId);

    // Show typing indicator
    await ctx.telegram.sendChatAction(ctx.chat!.id, "typing");

    // Generate response using AI Manager (checks preference)
    const response = await generateResponse(
      history,
      undefined,
      async (intermediateMsg: string) => {
        // Send intermediate message
        await ctx.reply(intermediateMsg);
      }
    );
    await ctx.reply(response);

    // Add model response to memory
    // Add model response to memory
    await addToHistory(userId, "model", response);

    // Log the conversation
    await logConversation(
      userId,
      ctx.from?.username || ctx.from?.first_name || "Unknown",
      combinedMessage,
      response
    );
  } catch (error) {
    console.error("Error generating response:", error);
    await ctx.reply("معلش، حصلت مشكلة. جرب تاني.");
  }
};

export const setupCommands = (bot: Telegraf<Context>) => {
  bot.command("start", async (ctx) => {
    await clearHistory(ctx.from.id);
    ctx.reply(
      "أهلاً! 😊 أنا مساعد الأستاذ. اسألني عن الكورسات والمواعيد والأسعار."
    );
  });

  bot.command("help", (ctx) =>
    ctx.reply(
      "ابعتلي أي سؤال وهرد عليك. استخدم /model لتغيير الذكاء الاصطناعي."
    )
  );

  bot.command("model", (ctx) => {
    const model = ctx.message.text.split(" ")[1]?.toLowerCase();
    const models: Record<string, string> = {
      gemini: "Google Gemini 🧠",
      mistral: "Mistral AI 🌪️",
      openai: "OpenAI (ChatGPT) 🤖",
    };

    if (model && models[model]) {
      setGlobalModel(model as any);
      ctx.reply(`تمام! تم التبديل إلى ${models[model]}`);
    } else {
      ctx.reply("اختر موديل:\n/model gemini\n/model mistral\n/model openai");
    }
  });

  bot.on(message("photo"), async (ctx) => {
    try {
      // Get the largest photo (last in array)
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const imageUrl = fileLink.href;

      const caption = ctx.message.caption || "Please analyze this image.";

      const userId = ctx.from.id;
      await addToHistory(userId, "user", caption);
      const history = await getHistory(userId);

      const response = await generateResponse(history, imageUrl);
      await ctx.reply(response);
      await addToHistory(userId, "model", response);

      await logConversation(
        ctx.from.id,
        ctx.from.username || ctx.from.first_name,
        `[Photo] ${caption}`,
        response
      );
    } catch (error) {
      console.error("Error processing photo:", error);
      await ctx.reply("معلش، مش قادر أحمل الصورة.");
    }
  });

  bot.on(message("text"), async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userBuffers.has(userId)) {
      const buffer = userBuffers.get(userId)!;
      clearTimeout(buffer.timeout);
      buffer.lines.push(text);
      buffer.ctx = ctx; // Update context to latest
      buffer.timeout = setTimeout(() => processBufferedMessages(userId), 3000);
    } else {
      userBuffers.set(userId, {
        lines: [text],
        ctx: ctx,
        timeout: setTimeout(() => processBufferedMessages(userId), 3000),
      });
    }
  });
};
