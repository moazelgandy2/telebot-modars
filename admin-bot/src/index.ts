
import { Telegraf, Context, Markup } from "telegraf";
import axios from "axios";
import { config } from "./config";

if (!config.botToken) {
  console.error("Error: BOT_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

// Verify Token
bot.telegram.getMe().then((botInfo) => {
    console.log(`✅ Token valid! Bot Name: ${botInfo.first_name} (@${botInfo.username})`);
}).catch((err) => {
    console.error("❌ Failed to verify bot token. Check your .env file!", err);
    process.exit(1);
});

// --- Types ---
interface AdminUser {
    userId: string;
    role: string; // 'SUPER_ADMIN', 'EDITOR', 'MODERATOR'
    permissions: string[]; // 'MANAGE_USERS', 'MANAGE_CONTENT', 'MANAGE_ADMINS'
}

interface UserState {
  action?:
    | 'WAITING_ADD_USER_ID' | 'WAITING_ADD_USER_NAME'
    | 'WAITING_DEL_USER'
    | 'WAITING_SET_SYSTEM'
    | 'WAITING_ADD_FAQ_Q' | 'WAITING_ADD_FAQ_A'
    | 'WAITING_DEL_FAQ'
    | 'WAITING_ADD_ADMIN_ID' | 'WAITING_ADD_ADMIN_NAME' | 'WAITING_DEL_ADMIN';
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

// --- Auth & Permissions ---
const getAdminProfile = async (userId: number): Promise<AdminUser | null> => {
    // 1. Super Admins (Env) -> Full Access
    if (config.adminIds.includes(userId)) {
        return { userId: userId.toString(), role: 'SUPER_ADMIN', permissions: [] };
    }

    // 2. Database Admins
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success && Array.isArray(res.data.data)) {
            const admin = res.data.data.find((a: any) => a.userId === userId.toString());
            if (admin) {
                return {
                    userId: admin.userId,
                    role: admin.role,
                    permissions: admin.permissions || []
                };
            }
        }
    } catch (e) {
        console.error("Failed to fetch DB admins:", e);
    }
    return null;
};

// Permission Check Helper
const hasPermission = (admin: AdminUser, required: string): boolean => {
    if (admin.role === 'SUPER_ADMIN') return true;
    return admin.permissions.includes(required);
};

// Check Middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
      const admin = await getAdminProfile(ctx.from.id);
      if (admin) {
          ctx.state.admin = admin; // Store for handlers
          return next();
      }
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

// --- Dynamic Keyboards (RBAC) ---
const getMainMenu = (admin: AdminUser) => {
    const buttons = [];
    const row1 = [];
    // Everyone sees Stats
    row1.push(Markup.button.callback("📊 الإحصائيات", "menu_stats"));

    // Manage Users
    if (hasPermission(admin, 'MANAGE_USERS')) {
        row1.push(Markup.button.callback("👥 المشتركين", "menu_users"));
    }
    buttons.push(row1);

    const row2 = [];
    // Manage Content
    if (hasPermission(admin, 'MANAGE_CONTENT')) {
        row2.push(Markup.button.callback("� السيستم", "menu_system"));
        row2.push(Markup.button.callback("❓ الأسئلة", "menu_faqs"));
    }
    if (row2.length > 0) buttons.push(row2);

    // Manage Admins (Super Admin only usually)
    if (hasPermission(admin, 'MANAGE_ADMINS') || admin.role === 'SUPER_ADMIN') {
        buttons.push([Markup.button.callback("� المساعدين (Admins)", "menu_admins")]);
    }

    return Markup.inlineKeyboard(buttons);
};

const BackToMainBtn = Markup.button.callback("الرئيسية 🏠", "menu_main");
const CancelBtn = Markup.button.callback("إلغاء ❌", "cancel_action");

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
  const admin = (ctx.state as any).admin;
  ctx.reply("👋 **أهلاً يا ريس!**\nاختار اللي عايز تعمله من القائمة:", { parse_mode: "Markdown", ...getMainMenu(admin) });
});

bot.command("menu", (ctx) => {
    clearState(ctx.from.id);
    const admin = (ctx.state as any).admin;
    ctx.reply("👋 **القائمة الرئيسية**", { parse_mode: "Markdown", ...getMainMenu(admin) });
});

bot.action("menu_main", (ctx) => {
  clearState(ctx.from!.id);
  const admin = (ctx.state as any).admin;
  ctx.editMessageText("👋 **القائمة الرئيسية**\nتحب تعمل إيه النهارده؟", { parse_mode: "Markdown", ...getMainMenu(admin) });
});

bot.action("cancel_action", (ctx) => {
    clearState(ctx.from!.id);
    const admin = (ctx.state as any).admin;
    ctx.editMessageText("� **تم الإلغاء.**", { parse_mode: "Markdown", ...getMainMenu(admin) });
    ctx.answerCbQuery("تم الإلغاء");
});

// --- Menu Navigation (With Permission Checks) ---
bot.action("menu_users", (ctx) => {
    const admin = (ctx.state as any).admin;
    if (!hasPermission(admin, 'MANAGE_USERS')) return ctx.answerCbQuery("⛔ ليس لديك صلاحية!");
    ctx.editMessageText("� **إدارة المشتركين**", { parse_mode: "Markdown", ...UsersMenu });
});

bot.action("menu_system", (ctx) => {
    const admin = (ctx.state as any).admin;
    if (!hasPermission(admin, 'MANAGE_CONTENT')) return ctx.answerCbQuery("⛔ ليس لديك صلاحية!");
    ctx.editMessageText("📜 **تعليمات النظام**", { parse_mode: "Markdown", ...SystemMenu });
});

bot.action("menu_faqs", (ctx) => {
    const admin = (ctx.state as any).admin;
    if (!hasPermission(admin, 'MANAGE_CONTENT')) return ctx.answerCbQuery("⛔ ليس لديك صلاحية!");
    ctx.editMessageText("❓ **إدارة الأسئلة**", { parse_mode: "Markdown", ...FaqsMenu });
});

bot.action("menu_admins", (ctx) => {
    const admin = (ctx.state as any).admin;
    if (!hasPermission(admin, 'MANAGE_ADMINS') && admin.role !== 'SUPER_ADMIN') return ctx.answerCbQuery("⛔ ليس لديك صلاحية!");
    ctx.editMessageText(" **إدارة الآدمنز**", { parse_mode: "Markdown", ...AdminsMenu });
});


// --- Admins Management ---
const RoleMap: Record<string, string> = {
    'SUPER_ADMIN': 'مدير عام 🌟 (كامل الصلاحيات)',
    'EDITOR': 'محرر ✏️ (يستطيع إدارة المحتوى والمستخدمين)',
    'MODERATOR': 'مشرف 🛡️ (يستطيع إدارة المستخدمين فقط)'
};
const PermissionMap: Record<string, string> = {
    'MANAGE_USERS': '👥 إدارة المشتركين (إضافة/حذف)',
    'MANAGE_CONTENT': '📝 إدارة المحتوى (أسئلة/تعليمات)',
    'MANAGE_ADMINS': '👮 إدارة الآدمنز'
};

bot.action("admins_list", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success) {
            let msg = "📋 **قائمة الآدمنز**\n━━━━━━━━━━━━━━━━\n\n";
            // Env Admins
            config.adminIds.forEach(id => msg += `🔑 **Super Admin**\n🆔 \`${id}\`\n(صلاحيات كاملة)\n〰️〰️〰️〰️〰️\n`);

            // DB Admins
            if (res.data.data.length > 0) {
                res.data.data.forEach((a: any) => {
                    const roleName = RoleMap[a.role] || a.role;
                    msg += `👤 **${a.name || "بدون اسم"}**\n`;
                    msg += `🏷️ **الدور:** ${roleName}\n`;
                    msg += `🆔 \`${a.userId}\`\n`;

                    if(a.permissions && a.permissions.length > 0) {
                        const perms = a.permissions.map((p: string) => PermissionMap[p] || p).join('، ');
                        msg += `🔐 **الصلاحيات:** ${perms}\n`;
                    }

                    msg += `🔗 [بروفايل](tg://user?id=${a.userId})\n`;
                    msg += `〰️〰️〰️〰️〰️\n`;
                });
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
  const admin = (ctx.state as any).admin; // For validation if needed

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
      // Default new admins to EDITOR role with typical permissions for now
      // In a real/complex wizard we would ask for Role & Permissions too.
      // For now, let's give them MANAGE_USERS and MANAGE_CONTENT by default.
      try {
          const res = await axios.post(`${config.apiBaseUrl}/admins`, {
              userId: id,
              name,
              role: 'EDITOR',
              permissions: ['MANAGE_USERS', 'MANAGE_CONTENT']
          });

          if (res.data.success) {
              await ctx.reply(`🎉 **تم إضافة الأدمن بنجاح!**\n${name} (\`${id}\`)\nRole: EDITOR`, { parse_mode: "Markdown", ...AdminsMenu });
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

  // ... (Other handlers: User, FAQ, System) ...
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

// --- Action Handlers (Stats, Pagination) ---
bot.action("menu_stats", async (ctx) => {
  try {
    const res = await axios.get(`${config.apiBaseUrl}/stats`);
    if (res.data.success) {
      const { sessionsCount, messagesCount, instructionsCount, subscriptionsCount } = res.data.data;
      const subBar = createProgressBar(subscriptionsCount, 100);

      let msg = `📊 **إحصائيات البوت**\n━━━━━━━━━━━━━━━━\n\n`;
      msg += `👥 **الجلسات النشطة:** \`${sessionsCount}\`\n`;
      msg += `💬 **إجمالي الرسائل:** \`${messagesCount}\`\n\n`;
      msg += `✅ **المشتركين الحاليين:** \`${subscriptionsCount}\`\n`;
      msg += `[${subBar}] ${subscriptionsCount}/100\n\n`;
      msg += `📜 **نسخ التعليمات:** \`${instructionsCount}\``;

      await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[BackToMainBtn]]).reply_markup });
    }
  } catch (e) { await ctx.answerCbQuery("Error"); }
});

// User Pagination (Card Style)
bot.action(/users_list_(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const pageSize = 5; // Reduced page size for cards
  try {
    const res = await axios.get(`${config.apiBaseUrl}/subscription`);
    const data = res.data;
    if (data.success && Array.isArray(data.data)) {
      const total = data.data.length;
      const start = page * pageSize; const end = start + pageSize;
      const slice = data.data.slice(start, end);
      if (total === 0) { await ctx.editMessageText("📂 مفيش.", { reply_markup: UsersMenu.reply_markup }); return; }

      let msg = `📋 **قائمة المشتركين**\n🔢 الصفحة ${page + 1} من ${Math.ceil(total / pageSize)}\n━━━━━━━━━━━━━━━━\n\n`;
      slice.forEach((sub: any) => {
          const name = sub.name || "بدون اسم";
          msg += `👤 **${name}**\n`;
          msg += `🆔 \`${sub.userId}\`\n`;
          msg += `🔗 [بروفايل الطالب](tg://user?id=${sub.userId})\n`;
          msg += `〰️〰️〰️〰️〰️\n`;
      });

      const buttons = [];
      if (page > 0) buttons.push(Markup.button.callback("⬅️ السابق", `users_list_${page - 1}`));
      if (end < total) buttons.push(Markup.button.callback("التالي ➡️", `users_list_${page + 1}`));
      const kv = Markup.inlineKeyboard([buttons, [Markup.button.callback("🔙 القائمة السابقة", "menu_users")]]);
      await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kv.reply_markup });
    }
  } catch(e) { await ctx.answerCbQuery("Error"); }
});

// FAQ Pagination (Card Style)
bot.action(/faqs_list_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    const pageSize = 3; // Large cards, show fewer
    try {
        const res = await axios.get(`${config.apiBaseUrl}/faqs`);
        if (res.data.success) {
            const total = res.data.data.length;
            const start = page * pageSize; const end = start + pageSize;
            const slice = res.data.data.slice(start, end);
             if (total === 0) { await ctx.editMessageText("📂 مفيش.", { reply_markup: FaqsMenu.reply_markup }); return; }

            let msg = `❓ **الأسئلة الشائعة**\n🔢 الصفحة ${page + 1} من ${Math.ceil(total / pageSize)}\n━━━━━━━━━━━━━━━━\n\n`;
            slice.forEach((f: any) => {
                msg += `🛑 **س:** ${f.question}\n`;
                msg += `✅ **ج:** ${f.answer}\n`;
                msg += `🆔 \`${f.id}\`\n`;
                msg += `〰️〰️〰️〰️〰️\n`;
            });

            const buttons = [];
            if (page > 0) buttons.push(Markup.button.callback("⬅️ السابق", `faqs_list_${page - 1}`));
            if (end < total) buttons.push(Markup.button.callback("التالي ➡️", `faqs_list_${page + 1}`));
            const kv = Markup.inlineKeyboard([buttons, [Markup.button.callback("🔙 القائمة السابقة", "menu_faqs")]]);
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
    console.log("🚀 Admin Bot Pro (RBAC Enabled) started!");
    try {
        await bot.telegram.setMyCommands([
            { command: "menu", description: "القائمة الرئيسية" },
            { command: "stats", description: "الإحصائيات السريعة" }
        ]);
    } catch (e) { console.error("Failed to set menu commands", e); }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
