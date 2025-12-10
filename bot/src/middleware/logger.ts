import { Context } from "telegraf";

export const logger = async (ctx: Context, next: () => Promise<void>) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const updateType = ctx.updateType;
  console.log(`[${new Date().toISOString()}] Processing ${updateType} - ${ms}ms`);
};
