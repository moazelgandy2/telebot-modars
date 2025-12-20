
import { Telegraf, Context, Markup } from "telegraf";
import axios from "axios";
import { config } from "./config";

if (!config.botToken) {
  console.error("Error: BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

// Verify Token immediately
bot.telegram.getMe().then((botInfo) => {
    console.log(`✅ Token valid! Bot Name: ${botInfo.first_name} (@${botInfo.username})`);
}).catch((err) => {
    console.error("❌ Failed to verify bot token. Check your .env file!", err);
    process.exit(1);
});

// --- State Management ---
interface UserState {
  action?:
    | 'WAITING_ADD_USER_ID' | 'WAITING_ADD_USER_NAME'
    | 'WAITING_DEL_USER'
    | 'WAITING_SET_SYSTEM'
    | 'WAITING_ADD_FAQ_Q' | 'WAITING_ADD_FAQ_A'
    | 'WAITING_DEL_FAQ'
    | 'WAITING_ADD_ADMIN_ID' | 'WAITING_ADD_ADMIN_NAME' | 'WAITING_DEL_ADMIN'; // New Admin States
  page?: number;
  tempData?: any;
}
const userStates = new Map<number, UserState>();

const clearState = (userId: number) => userStates.delete(userId);
const setState = (userId: number, state: UserState) => {
    const current = userStates.get(userId) || {};
    userStates.set(userId, { ...current, ...state });
};
const getState = (userId: number) => userStates.get(userId);


const isAdmin = async (userId: number): Promise<boolean> => {
    if (config.adminIds.includes(userId)) return true;

    // 2. Check Database Admins
    console.log(`Checking DB for Admin ID: ${userId}`);
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success && Array.isArray(res.data.data)) {
            const dbAdmins = res.data.data.map((a: any) => a.userId);
            console.log("DB Admins:", dbAdmins);

            const isMatch = dbAdmins.includes(userId.toString());
            console.log(`Match Result: ${isMatch}`);
            if (isMatch) return true;
        } else {
            console.warn("Invalid API response format for admins:", res.data);
        }
    } catch (e) {
        console.error("Failed to fetch DB admins:", e);
    }
    return false;
};

bot.use(async (ctx, next) => {
  if (ctx.from) {
      const isUserAdmin = await isAdmin(ctx.from.id);
      if (isUserAdmin) return next();
  }
  // Ignore unauthorized
});

// --- Visual Helpers ---
const createProgressBar = (current: number, total: number, length = 10) => {
    const percent = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.round(length * percent);
    const empty = length - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
};

// --- Keyboards ---
const BackToMainBtn = Markup.button.callback("الرئيسية 🏠", "menu_main");
const CancelBtn = Markup.button.callback("إلغاء ❌", "cancel_action");

const MainMenu = Markup.inlineKeyboard([
  [Markup.button.callback("📊 الإحصائيات", "menu_stats"), Markup.button.callback("👥 المشتركين", "menu_users")],
  [Markup.button.callback("📜 تعليمات النظام", "menu_system"), Markup.button.callback("❓ الأسئلة الشائعة", "menu_faqs")],
  [Markup.button.callback("👮 المساعدين (Admins)", "menu_admins")]
]);

const UsersMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض القائمة 📃", "users_list_0")],
  [Markup.button.callback("➕ إضافة مشترك", "users_add_start"), Markup.button.callback("❌ حذف مشترك", "users_del")],
  [BackToMainBtn]
]);

const SystemMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض الحالية 👀", "system_view")],
  [Markup.button.callback("تعديل التعليمات ✏️", "system_edit")],
  [BackToMainBtn]
]);

const FaqsMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض القائمة 📃", "faqs_list_0")],
  [Markup.button.callback("➕ سؤال جديد", "faqs_add_start"), Markup.button.callback("❌ حذف سؤال", "faqs_del")],
  [BackToMainBtn]
]);

const AdminsMenu = Markup.inlineKeyboard([
    [Markup.button.callback("عرض القائمة 📃", "admins_list")],
    [Markup.button.callback("➕ إضافة أدمن", "admins_add_start"), Markup.button.callback("❌ حذف أدمن", "admins_del")],
    [BackToMainBtn]
]);


// --- Handlers ---
bot.start((ctx) => {
  clearState(ctx.from.id);
  ctx.reply("👋 **أهلاً يا ريس!**\nاختار اللي عايز تعمله من القائمة:", { parse_mode: "Markdown", ...MainMenu });
});
bot.command("menu", (ctx) => {
    clearState(ctx.from.id);
    ctx.reply("👋 **القائمة الرئيسية**", { parse_mode: "Markdown", ...MainMenu });
});

bot.action("menu_main", (ctx) => {
  clearState(ctx.from!.id);
  ctx.editMessageText("👋 **القائمة الرئيسية**\nتحب تعمل إيه النهارده؟", { parse_mode: "Markdown", ...MainMenu });
});

bot.action("menu_users", (ctx) => ctx.editMessageText("👥 **إدارة المشتركين**", { parse_mode: "Markdown", ...UsersMenu }));
bot.action("menu_system", (ctx) => ctx.editMessageText("📜 **تعليمات النظام**", { parse_mode: "Markdown", ...SystemMenu }));
bot.action("menu_faqs", (ctx) => ctx.editMessageText("❓ **إدارة الأسئلة**", { parse_mode: "Markdown", ...FaqsMenu }));
bot.action("menu_admins", (ctx) => ctx.editMessageText("👮 **إدارة الآدمنز**", { parse_mode: "Markdown", ...AdminsMenu }));

bot.action("cancel_action", (ctx) => {
    clearState(ctx.from!.id);
    ctx.editMessageText("🚫 **تم الإلغاء.**", { parse_mode: "Markdown", ...MainMenu });
    ctx.answerCbQuery("تم الإلغاء");
});

// --- Admins Management ---
bot.action("admins_list", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success) {
            let msg = "**👮 قائمة الآدمنز:**\n\n";
            // Env Admins
            config.adminIds.forEach(id => msg += `🔑 \`${id}\` (Super Admin)\n`);
            // DB Admins
            if (res.data.data.length > 0) {
                res.data.data.forEach((a: any) => msg += `👤 \`${a.userId}\` | ${a.name || "No Name"}\n`);
            } else {
                msg += "(مفيش آدمنز إضافيين)";
            }
            await ctx.editMessageText(msg, { parse_mode: "Markdown", ...AdminsMenu });
        } else {
            await ctx.answerCbQuery("Error");
        }
    } catch (e) { await ctx.answerCbQuery("Error"); }
});

bot.action("admins_add_start", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_ADD_ADMIN_ID', tempData: {} });
    ctx.editMessageText(
        "👮 **إضافة أدمن جديد (1/2)**\n\nابعتلي **الآيدي (Telegrarm ID)** بتاعه.",
        { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
    );
});

bot.action("admins_del", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_DEL_ADMIN' });
    ctx.editMessageText(
        "🗑️ **حذف أدمن**\n\nابعتلي **الآيدي** اللي عايز تحذفه.",
        { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
    );
});


// --- Text Handler ---
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = getState(userId);
  if (!state || !state.action) return;

  const text = ctx.message.text.trim();

  // --- Add Admin Wizard ---
  if (state.action === 'WAITING_ADD_ADMIN_ID') {
      setState(userId, { action: 'WAITING_ADD_ADMIN_NAME', tempData: { id: text } });
      await ctx.reply(`✅ الآيدي: \`${text}\`\n\n👤 **(2/2) الاسم إيه؟**`,
          { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
      );
      return;
  }
  if (state.action === 'WAITING_ADD_ADMIN_NAME') {
      const id = state.tempData.id;
      const name = text;
      try {
          const res = await axios.post(`${config.apiBaseUrl}/admins`, { userId: id, name });
          if (res.data.success) {
              await ctx.reply(`🎉 **تم إضافة الأدمن بنجاح!**\n${name} (\`${id}\`)`, { parse_mode: "Markdown", ...AdminsMenu });
              clearState(userId);
          } else {
              await ctx.reply(`❌ خطأ: ${res.data.error}`, { ...AdminsMenu });
          }
      } catch (e) { await ctx.reply("❌ Error"); }
      return;
  }

  // --- Delete Admin ---
  if (state.action === 'WAITING_DEL_ADMIN') {
      try {
          const res = await axios.delete(`${config.apiBaseUrl}/admins`, { params: { userId: text } });
          if (res.data.success) {
              await ctx.reply("🗑️ **تم حذف الأدمن.**", { parse_mode: "Markdown", ...AdminsMenu });
              clearState(userId);
          } else {
              await ctx.reply(`❌ خطأ: ${res.data.error}`);
          }
      } catch (e) { await ctx.reply("❌ Error"); }
      return;
  }


  if (state.action === 'WAITING_ADD_USER_ID') {
      setState(userId, { action: 'WAITING_ADD_USER_NAME', tempData: { id: text } });
      await ctx.reply(`✅ تمام. الآيدي: \`${text}\`\n\n👤 **(خطوة 2/2)** اكتب اسم الطالب دلوقتي:`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
      return;
  }
  if (state.action === 'WAITING_ADD_USER_NAME') {
      try {
        await axios.post(`${config.apiBaseUrl}/subscription`, { userId: state.tempData.id, name: text });
        await ctx.reply(`🎉 **تمت الإضافة بنجاح!**`, { parse_mode: "Markdown", ...UsersMenu });
        clearState(userId);
      } catch (e) { await ctx.reply("❌ Error"); }
      return;
  }
  if (state.action === 'WAITING_DEL_USER') {
      try {
        await axios.delete(`${config.apiBaseUrl}/subscription`, { params: { userId: text } });
        await ctx.reply(`🗑️ تم الحذف.`, { ...UsersMenu });
        clearState(userId);
      } catch (e) { await ctx.reply("❌ Error"); }
      return;
  }

  if (state.action === 'WAITING_ADD_FAQ_Q') {
      setState(userId, { action: 'WAITING_ADD_FAQ_A', tempData: { q: text } });
      await ctx.reply(`✅ السؤال: "${text}"\n\n📝 **(خطوة 2/2)** اكتب الإجابة دلوقتي:`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
      return;
  }
  if (state.action === 'WAITING_ADD_FAQ_A') {
      try {
        await axios.post(`${config.apiBaseUrl}/faqs`, { question: state.tempData.q, answer: text });
        await ctx.reply(`🎉 **تم حفظ السؤال!**`, { ...FaqsMenu });
        clearState(userId);
      } catch (e) { await ctx.reply("❌ Error"); }
      return;
  }
  if (state.action === 'WAITING_DEL_FAQ') {
      try {
        await axios.delete(`${config.apiBaseUrl}/faqs`, { params: { id: text } });
        await ctx.reply(`🗑️ تم الحذف.`, { ...FaqsMenu });
        clearState(userId);
      } catch (e) { await ctx.reply("❌ Error"); }
      return;
  }

  if (state.action === 'WAITING_SET_SYSTEM') {
      try {
        await axios.post(`${config.apiBaseUrl}/system-instruction`, { content: text });
        await ctx.reply("✅ تم التحديث.", { ...SystemMenu });
        clearState(userId);
      } catch (e) { await ctx.reply("❌ Error"); }
      return;
  }

});

bot.action("menu_stats", async (ctx) => {
  try {
    const res = await axios.get(`${config.apiBaseUrl}/stats`);
    if (res.data.success) {
      const { sessionsCount, messagesCount, instructionsCount, subscriptionsCount } = res.data.data;
      const subBar = createProgressBar(subscriptionsCount, 100);
      await ctx.editMessageText(
        `**📊 إحصائيات البوت**\n\n` +
        `👥 **الجلسات النشطة:** \`${sessionsCount}\`\n` +
        `💬 **إجمالي الرسائل:** \`${messagesCount}\`\n\n` +
        `✅ **المشتركين الحاليين:** \`${subscriptionsCount}\`\n` +
        `[${subBar}] ${subscriptionsCount}/100\n\n` +
        `📜 **نسخ التعليمات:** \`${instructionsCount}\``,
        { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[BackToMainBtn]]).reply_markup }
      );
    }
  } catch (e) { await ctx.answerCbQuery("Error"); }
});

// User Pagination
bot.action(/users_list_(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const pageSize = 10;
  try {
    const res = await axios.get(`${config.apiBaseUrl}/subscription`);
    const data = res.data;
    if (data.success && Array.isArray(data.data)) {
      const total = data.data.length;
      const start = page * pageSize; const end = start + pageSize;
      const slice = data.data.slice(start, end);
      if (total === 0) { await ctx.editMessageText("📂 مفيش.", { reply_markup: UsersMenu.reply_markup }); return; }
      let msg = `**📃 المشتركين (${start + 1}-${Math.min(end, total)} من ${total}):**\n\n`;
      slice.forEach((sub: any) => msg += `🆔 \`${sub.userId}\` | ${sub.name}\n`);
      const buttons = [];
      if (page > 0) buttons.push(Markup.button.callback("⬅️", `users_list_${page - 1}`));
      if (end < total) buttons.push(Markup.button.callback("➡️", `users_list_${page + 1}`));
      const kv = Markup.inlineKeyboard([buttons, [Markup.button.callback("🔙 رجوع", "menu_users")]]);
      await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kv.reply_markup });
    }
  } catch(e) { await ctx.answerCbQuery("Error"); }
});

// FAQ Pagination
bot.action(/faqs_list_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    const pageSize = 5;
    try {
        const res = await axios.get(`${config.apiBaseUrl}/faqs`);
        if (res.data.success) {
            const total = res.data.data.length;
            const start = page * pageSize; const end = start + pageSize;
            const slice = res.data.data.slice(start, end);
             if (total === 0) { await ctx.editMessageText("📂 مفيش.", { reply_markup: FaqsMenu.reply_markup }); return; }
            let msg = `**❓ الأسئلة (${start+1}-${Math.min(end,total)}):**\n\n`;
            slice.forEach((f: any) => msg += `**س:** ${f.question}\n**ج:** ${f.answer}\n🆔 \`${f.id}\`\n---\n`);
            const buttons = [];
            if (page > 0) buttons.push(Markup.button.callback("⬅️", `faqs_list_${page - 1}`));
            if (end < total) buttons.push(Markup.button.callback("➡️", `faqs_list_${page + 1}`));
            const kv = Markup.inlineKeyboard([buttons, [Markup.button.callback("🔙 رجوع", "menu_faqs")]]);
            await ctx.editMessageText(msg, {parse_mode:"Markdown", reply_markup: kv.reply_markup});
        }
    } catch(e) { await ctx.answerCbQuery("Error"); }
});

bot.action("users_add_start", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_ADD_USER_ID', tempData: {} });
  ctx.editMessageText("👤 **إضافة مشترك (1/2)**\n\nابعت **الآيدي** (ID).", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});
bot.action("users_del", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_DEL_USER' });
  ctx.editMessageText("🗑️ **حذف مشترك**\n\nابعت **الآيدي**.", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});
bot.action("faqs_add_start", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_ADD_FAQ_Q', tempData: {} });
  ctx.editMessageText("❓ **سؤال جديد (1/2)**\n\nاكتب **السؤال**.", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});
bot.action("faqs_del", (ctx) => {
  setState(ctx.from!.id, { action: 'WAITING_DEL_FAQ' });
  ctx.editMessageText("🗑️ **حذف سؤال**\n\nابعت **الآيدي**.", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});
bot.action("system_edit", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_SET_SYSTEM' });
    ctx.editMessageText("✏️ ابعت التعليمات الجديدة.", { ...Markup.inlineKeyboard([[CancelBtn]]) });
});
bot.action("system_view", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/system-instruction`);
        if (res.data.success && res.data.data) {
            await ctx.editMessageText(`**📜:**\n\`${res.data.data.content.substring(0, 3000)}\``, { parse_mode: "Markdown", ...SystemMenu });
        }
    } catch(e) { await ctx.answerCbQuery("Error"); }
});


// Launch
bot.launch().then(async () => {
    console.log("🚀 Admin Bot Pro (DB Admins) started!");
    try {
        await bot.telegram.setMyCommands([
            { command: "menu", description: "القائمة الرئيسية" },
            { command: "stats", description: "الإحصائيات السريعة" }
        ]);
    } catch (e) { console.error("Failed to set menu commands", e); }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
