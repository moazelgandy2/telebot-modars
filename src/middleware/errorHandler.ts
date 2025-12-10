import { Context } from "telegraf";

export const errorHandler = async (error: unknown, ctx: Context) => {
  console.error(`Error for ${ctx.updateType}`, error);
  try {
    await ctx.reply("An error occurred while processing your request.");
  } catch (e) {
    console.error("Could not send error message to user", e);
  }
};
