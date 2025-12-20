
import { Telegraf, Context, Markup } from "telegraf";
import axios from "axios";
import { config } from "./config";

if (!config.botToken) {
  console.error("Error: BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new Telegraf(config.botToken);


bot.telegram.getMe().then((botInfo) => {
    console.log(`✅ Token valid! Bot Name: ${botInfo.first_name} (@${botInfo.username})`);
}).catch((err) => {
    console.error("❌ Failed to verify bot token. Check your .env file!", err);
    process.exit(1);
});


// --- State Management ---
interface UserState {
  action?: 'WAITING_ADD_USER' | 'WAITING_DEL_USER' | 'WAITING_SET_SYSTEM' | 'WAITING_ADD_FAQ' | 'WAITING_DEL_FAQ';
  page?: number; // For pagination
  data?: any;
}
const userStates = new Map<number, UserState>();

const clearState = (userId: number) => userStates.delete(userId);
const setState = (userId: number, state: UserState) => userStates.set(userId, { ...userStates.get(userId), ...state });
const getState = (userId: number) => userStates.get(userId);

// --- Middleware: Admin Check ---
const isAdmin = (userId: number) => config.adminIds.includes(userId);

bot.use(async (ctx, next) => {
  if (ctx.from && isAdmin(ctx.from.id)) {
    return next();
  } else {
     // Ignore unauthorized
  }
});

// --- Common Keyboards ---
const BackToMainBtn = Markup.button.callback("الرئيسية 🏠", "menu_main");
const CancelBtn = Markup.button.callback("إلغاء ❌", "cancel_action");

const MainMenu = Markup.inlineKeyboard([
  [Markup.button.callback("📊 الإحصائيات", "menu_stats"), Markup.button.callback("👥 المشتركين", "menu_users")],
  [Markup.button.callback("📜 تعليمات النظام", "menu_system"), Markup.button.callback("❓ الأسئلة الشائعة", "menu_faqs")]
]);

const UsersMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض القائمة 📃", "users_list_0")], // Start at page 0
  [Markup.button.callback("➕ إضافة مشترك", "users_add"), Markup.button.callback("❌ حذف مسشترك", "users_del")],
  [BackToMainBtn]
]);

const SystemMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض الحالية 👀", "system_view")],
  [Markup.button.callback("تعديل التعليمات ✏️", "system_edit")],
  [BackToMainBtn]
]);

const FaqsMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض القائمة 📃", "faqs_list_0")],
  [Markup.button.callback("➕ سؤال جديد", "faqs_add"), Markup.button.callback("❌ حذف سؤال", "faqs_del")],
  [BackToMainBtn]
]);

// --- Command Handlers ---
bot.start((ctx) => {
  clearState(ctx.from.id);
  ctx.reply("👋 **أهلاً يا ريس!**\nاختار اللي عايز تعمله من القائمة:", { parse_mode: "Markdown", ...MainMenu });
});

// --- Navigation Handlers ---
bot.action("menu_main", (ctx) => {
  clearState(ctx.from!.id);
  ctx.editMessageText("👋 **القائمة الرئيسية**\nتحب تعمل إيه النهارده؟", { parse_mode: "Markdown", ...MainMenu });
});

bot.action("menu_users", (ctx) => ctx.editMessageText("👥 **إدارة المشتركين**", { parse_mode: "Markdown", ...UsersMenu }));
bot.action("menu_system", (ctx) => ctx.editMessageText("📜 **تعليمات النظام (الذكاء الاصطناعي)**", { parse_mode: "Markdown", ...SystemMenu }));
bot.action("menu_faqs", (ctx) => ctx.editMessageText("❓ **إدارة الأسئلة الشائعة**", { parse_mode: "Markdown", ...FaqsMenu }));

bot.action("cancel_action", (ctx) => {
    clearState(ctx.from!.id);
    ctx.editMessageText("🚫 **تم الإلغاء.**\nرجعنا للقائمة الرئيسية.", { parse_mode: "Markdown", ...MainMenu });
    ctx.answerCbQuery("تم الإلغاء");
});

// --- Statistics ---
bot.action("menu_stats", async (ctx) => {
  try {
    const res = await axios.get(`${config.apiBaseUrl}/stats`);
    const data = res.data;
    if (data.success) {
      const { sessionsCount, messagesCount, instructionsCount, subscriptionsCount } = data.data;
      await ctx.editMessageText(
        `**📊 إحصائيات البوت**\n\n` +
        `👥 الجلسات النشطة: \`${sessionsCount}\`\n` +
        `💬 إجمالي الرسائل: \`${messagesCount}\`\n` +
        `📜 تعليمات النظام: \`${instructionsCount}\`\n` +
        `✅ المشتركين الحاليين: \`${subscriptionsCount}\``,
        { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[BackToMainBtn]]).reply_markup }
      );
    } else {
      await ctx.answerCbQuery("فشل تحميل البيانات");
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCbQuery("حصل خطأ في الاتصال");
  }
});

// --- User Management Logic (Pagination) ---
bot.action(/users_list_(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const pageSize = 10;

  try {
    const res = await axios.get(`${config.apiBaseUrl}/subscription`);
    const data = res.data;
    if (data.success && Array.isArray(data.data)) {
      if (data.data.length === 0) {
        await ctx.editMessageText("📂 مفيش مشتركين حالياً.", { reply_markup: UsersMenu.reply_markup });
        return;
      }

      const total = data.data.length;
      const start = page * pageSize;
      const end = start + pageSize;
      const slice = data.data.slice(start, end);

      let msg = `**📃 قائمة المشتركين (${start + 1}-${Math.min(end, total)} من ${total}):**\n\n`;
      slice.forEach((sub: any) => {
        msg += `🆔 \`${sub.userId}\` | 👤 ${sub.name || "مجهول"}\n`;
      });

      // Pagination Buttons
      const buttons = [];
      if (page > 0) buttons.push(Markup.button.callback("⬅️ السابق", `users_list_${page - 1}`));
      if (end < total) buttons.push(Markup.button.callback("التالي ➡️", `users_list_${page + 1}`));

      const keyboard = Markup.inlineKeyboard([
          buttons,
          [Markup.button.callback("🔙 رجوع للقائمة", "menu_users")]
      ]);

      await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: keyboard.reply_markup });
    } else {
       await ctx.answerCbQuery("فشل تحميل المشتركين");
    }
  } catch (e) {
    await ctx.answerCbQuery("خطأ في الاتصال");
  }
});

bot.action("users_add", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_ADD_USER' });
  ctx.editMessageText(
      "✏️ **إضافة مشترط جديد**\n\n" +
      "ابعتلي الآيدي والاسم بالشكل ده:\n" +
      "`123456789 الاسم`\n\n" +
      "أو دوس إلغاء للرجوع.",
      { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
  );
});

bot.action("users_del", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_DEL_USER' });
  ctx.editMessageText(
      "🗑️ **حذف مشترك**\n\n" +
      "ابعتلي **الآيدي** (User ID) اللي عايز تحذفه.\n\n" +
      "أو دوس إلغاء.",
      { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
  );
});

// --- System Instruction Logic ---
bot.action("system_view", async (ctx) => {
  try {
    const res = await axios.get(`${config.apiBaseUrl}/system-instruction`);
    const data = res.data;
    if (data.success && data.data) {
        const content = data.data.content;
        const preview = content.length > 3000 ? content.substring(0, 3000) + "..." : content;
        await ctx.editMessageText(
            `**📜 التعليمات الحالية:**\n\n\`\`\`\n${preview}\n\`\`\``,
            { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[Markup.button.callback("تعديل ✏️", "system_edit")], [Markup.button.callback("🔙 القائمة", "menu_system")]]).reply_markup }
        );
    } else {
       await ctx.answerCbQuery("فشل التحميل");
    }
  } catch (e) {
    await ctx.answerCbQuery("خطأ في الاتصال");
  }
});

bot.action("system_edit", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_SET_SYSTEM' });
  ctx.editMessageText(
      "✏️ **تعديل تعليمات النظام**\n\n" +
      "ابعتلي التعليمات الجديدة دلوقتي.\n" +
      "⚠️ خد بالك: ده هيغير شخصية البوت فوراً.",
      { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
  );
});

// --- FAQ Logic (Pagination) ---
bot.action(/faqs_list_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    const pageSize = 5; // FAQs are larger, show fewer

    try {
      const res = await axios.get(`${config.apiBaseUrl}/faqs`);
      const data = res.data;
      if (data.success && Array.isArray(data.data)) {
          if (data.data.length === 0) {
              await ctx.editMessageText("📂 مفيش أسئلة شائعة.", { reply_markup: FaqsMenu.reply_markup });
              return;
          }

          const total = data.data.length;
          const start = page * pageSize;
          const end = start + pageSize;
          const slice = data.data.slice(start, end);

          let msg = `**❓ الأسئلة الشائعة (${start + 1}-${Math.min(end, total)} من ${total}):**\n\n`;
          slice.forEach((faq: any, i: number) => {
              msg += `**س:** ${faq.question}\n**ج:** ${faq.answer}\n🆔 \`${faq.id}\`\n---\n`;
          });

          if (msg.length > 4000) msg = msg.substring(0, 4000) + "\n...(تم القص عشان الرسالة طويلة)";

          const buttons = [];
          if (page > 0) buttons.push(Markup.button.callback("⬅️ السابق", `faqs_list_${page - 1}`));
          if (end < total) buttons.push(Markup.button.callback("التالي ➡️", `faqs_list_${page + 1}`));

          const keyboard = Markup.inlineKeyboard([
            buttons,
            [Markup.button.callback("🔙 رجوع للقائمة", "menu_faqs")]
          ]);

          await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: keyboard.reply_markup });
      } else {
         await ctx.answerCbQuery("فشل التحميل");
      }
    } catch (e) {
       await ctx.answerCbQuery("خطأ في الاتصال");
    }
  });

bot.action("faqs_add", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_ADD_FAQ' });
  ctx.editMessageText(
      "✏️ **إضافة سؤال جديد**\n\n" +
      "ابعتلي السؤال والإجابة وبينهم علامة `|` بالشكل ده:\n" +
      "`السؤال هنا؟ | الإجابة هنا`",
      { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
  );
});

bot.action("faqs_del", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_DEL_FAQ' });
  ctx.editMessageText(
      "🗑️ **حذف سؤال**\n\n" +
      "ابعتلي **الآيدي** (ID) بتاع السؤال اللي عايز تمسحه.",
      { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
  );
});


// --- Text Input Handler ---
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state || !state.action) {
     return; // Ignore normal chat
  }

  const text = ctx.message.text.trim();

  // 1. Add User
  if (state.action === 'WAITING_ADD_USER') {
      const parts = text.split(" ");
      if (parts.length < 2) {
          return ctx.reply("⚠️ التنسيق غلط. حاول تاني:\n`id name`", { parse_mode: "Markdown" });
      }
      const targetId = parts[0];
      const name = parts.slice(1).join(" ");

      try {
        const res = await axios.post(`${config.apiBaseUrl}/subscription`, { userId: targetId, name });
        if (res.data.success) {
            await ctx.reply(`✅ تم إضافة **${name}** بنجاح!`, { parse_mode: "Markdown", ...UsersMenu });
            clearState(userId);
        } else {
            await ctx.reply(`❌ حصل خطأ: ${res.data.error}`);
        }
      } catch (e) {
         await ctx.reply("❌ مشكلة في السيرفر.");
      }
      return;
  }

  // 2. Remove User
  if (state.action === 'WAITING_DEL_USER') {
      const targetId = text;
      try {
        const res = await axios.delete(`${config.apiBaseUrl}/subscription`, { params: { userId: targetId } });
        if (res.data.success) {
            await ctx.reply(`🗑️ تم حذف المشترك \`${targetId}\`.`, { parse_mode: "Markdown", ...UsersMenu });
            clearState(userId);
        } else {
            await ctx.reply(`❌ خطأ: ${res.data.error}`);
        }
      } catch (e) {
         await ctx.reply("❌ مشكلة في السيرفر.");
      }
      return;
  }

  // 3. Set System Instruction
  if (state.action === 'WAITING_SET_SYSTEM') {
      try {
        const res = await axios.post(`${config.apiBaseUrl}/system-instruction`, { content: text });
        if (res.data.success) {
            await ctx.reply("✅ تم تحديث التعليمات بنجاح!", { ...SystemMenu });
            clearState(userId);
        } else {
            await ctx.reply(`❌ خطأ: ${res.data.error}`);
        }
      } catch (e) {
         await ctx.reply("❌ مشكلة في السيرفر.");
      }
      return;
  }

  // 4. Add FAQ
  if (state.action === 'WAITING_ADD_FAQ') {
      const parts = text.split("|");
      if (parts.length < 2) {
          return ctx.reply("⚠️ التنسيق غلط. لازم يكون فيه `|` بين السؤال والإجابة.", { parse_mode: "Markdown" });
      }
      const question = parts[0].trim();
      const answer = parts.slice(1).join("|").trim();

      try {
        const res = await axios.post(`${config.apiBaseUrl}/faqs`, { question, answer });
        if (res.data.success) {
            await ctx.reply("✅ تم إضافة السؤال بنجاح!", { ...FaqsMenu });
            clearState(userId);
        } else {
            await ctx.reply(`❌ خطأ: ${res.data.error}`);
        }
      } catch (e) {
         await ctx.reply("❌ مشكلة في السيرفر.");
      }
      return;
  }

  // 5. Delete FAQ
  if (state.action === 'WAITING_DEL_FAQ') {
      try {
        const res = await axios.delete(`${config.apiBaseUrl}/faqs`, { params: { id: text } });
        if (res.data.success) {
            await ctx.reply(`🗑️ تم حذف السؤال.`, { ...FaqsMenu });
            clearState(userId);
        } else {
            await ctx.reply(`❌ خطأ: ${res.data.error}`);
        }
      } catch (e) {
         await ctx.reply("❌ مشكلة في السيرفر.");
      }
      return;
  }

});

// Launch Bot
bot.launch().then(() => {
    console.log("🚀 Admin Bot UI (Egyptian) started!");
}).catch((err) => {
    console.error("Failed to start bot:", err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
