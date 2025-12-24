
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
    role: string;
    permissions: string[];
    name?: string;
}

interface UserState {
  action?:
    | 'WAITING_ADD_USER_ID' | 'WAITING_ADD_USER_NAME' | 'WAITING_ADD_USER_START_DATE' | 'WAITING_ADD_USER_DURATION'
    | 'WAITING_DEL_USER' | 'WAITING_EDIT_USER_START_DATE' | 'WAITING_EDIT_USER_DURATION'
    | 'WAITING_SET_SYSTEM'
    | 'WAITING_ADD_FAQ_Q' | 'WAITING_ADD_FAQ_A'
    | 'WAITING_DEL_FAQ'
    | 'WAITING_ADD_ADMIN_ID' | 'WAITING_ADD_ADMIN_NAME' | 'WAITING_ADD_ADMIN_ROLE' | 'WAITING_ADD_ADMIN_PERMS'
    | 'WAITING_DEL_ADMIN'
    | 'WAITING_EDIT_ADMIN_ID' | 'WAITING_EDIT_ADMIN_SELECT' | 'WAITING_EDIT_ADMIN_NAME'
    | 'WAITING_SET_HOURS_START' | 'WAITING_SET_HOURS_END'
    | 'WAITING_BROADCAST_MSG' | 'WAITING_BROADCAST_CONFIRM';
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
    if (config.adminIds.includes(userId)) {
        return { userId: userId.toString(), role: 'SUPER_ADMIN', permissions: [] };
    }
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success && Array.isArray(res.data.data)) {
            const admin = res.data.data.find((a: any) => a.userId === userId.toString());
            if (admin) {
                return {
                    userId: admin.userId,
                    role: admin.role,
                    permissions: admin.permissions || [],
                    name: admin.name
                };
            }
        }
    } catch (e) { console.error("Failed to fetch DB admins:", e); }
    return null;
};

const hasPermission = (admin: AdminUser, required: string): boolean => {
    if (admin.role === 'SUPER_ADMIN') return true;
    return admin.permissions.includes(required);
};

bot.use(async (ctx, next) => {
  if (ctx.from) {
      const admin = await getAdminProfile(ctx.from.id);
      if (admin) {
          ctx.state.admin = admin;
          return next();
      }
  }
});

// --- Constants & Maps ---
const RoleMap: Record<string, string> = {
    'SUPER_ADMIN': 'مدير عام 🌟 (كامل الصلاحيات)',
    'EDITOR': 'محرر ✏️ (يستطيع إدارة المحتوى والمستخدمين)',
    'MODERATOR': 'مشرف 🛡️ (يستطيع إدارة المستخدمين فقط)'
};
const PermissionMap: Record<string, string> = {
    'MANAGE_USERS': '👥 المشتركين',
    'MANAGE_CONTENT': '📝 المحتوى',
    'MANAGE_ADMINS': '👮 الآدمنز'
};
const AllPermissions = Object.keys(PermissionMap);

// --- Helpers ---
const createProgressBar = (current: number, total: number, length = 10) => {
    const percent = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.round(length * percent);
    const empty = length - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
};

const getRoleKeyboard = (prefix: string) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback("Editor ✏️", `${prefix}_EDITOR`)],
        [Markup.button.callback("Moderator 🛡️", `${prefix}_MODERATOR`)],
        [Markup.button.callback("Super Admin 🌟", `${prefix}_SUPER_ADMIN`)]
    ]);
};

const getPermissionsKeyboard = (selected: string[], prefix: string, doneAction: string) => {
    const buttons = AllPermissions.map(p => {
        const isSelected = selected.includes(p);
        const icon = isSelected ? "✅" : "❌";
        return [Markup.button.callback(`${icon} ${PermissionMap[p]}`, `${prefix}_TOGGLE_${p}`)];
    });
    buttons.push([Markup.button.callback("💾 حفظ وإنهاء", doneAction)]);
    return Markup.inlineKeyboard(buttons);
};

// --- Keyboards ---
const BackToMainBtn = Markup.button.callback("الرئيسية 🏠", "menu_main");
const CancelBtn = Markup.button.callback("إلغاء ❌", "cancel_action");

const getMainMenu = (admin: AdminUser) => {
    const buttons = [];
    const row1 = [Markup.button.callback("📊 الإحصائيات", "menu_stats")];
    if (hasPermission(admin, 'MANAGE_USERS')) row1.push(Markup.button.callback("👥 المشتركين", "menu_users"));
    buttons.push(row1);

    const row2 = [];
    if (hasPermission(admin, 'MANAGE_CONTENT')) {
        row2.push(Markup.button.callback("📜 السيستم", "menu_system"));
        row2.push(Markup.button.callback("❓ الأسئلة", "menu_faqs"));
    }
    if (row2.length > 0) buttons.push(row2);

    if (hasPermission(admin, 'MANAGE_ADMINS') || admin.role === 'SUPER_ADMIN') {
        buttons.push([Markup.button.callback("👮 المساعدين (Admins)", "menu_admins")]);
    }
    return Markup.inlineKeyboard(buttons);
};

// Define constants here so they are available globally
const UsersMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض القائمة 📃", "users_list_0")],
  [Markup.button.callback("➕ إضافة مشترك", "users_add_start"), Markup.button.callback("✏️ تعديل مشترك", "users_edit_list_0")],
  [Markup.button.callback("❌ حذف مشترك", "users_del_list_0")],
  [BackToMainBtn]
]);

const SystemMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض الحالية 👀", "system_view")],
  [Markup.button.callback("تعديل التعليمات ✏️", "system_edit")],
  [Markup.button.callback("تعديل التعليمات ✏️", "system_edit")],
  [Markup.button.callback("🕰️ ساعات العمل", "hours_view")],
  [Markup.button.callback("📢 إذاعة (للجميع) 📡", "broadcast_start")],
  [BackToMainBtn]
]);

const FaqsMenu = Markup.inlineKeyboard([
  [Markup.button.callback("عرض القائمة 📃", "faqs_list_0")],
  [Markup.button.callback("➕ سؤال جديد", "faqs_add_start"), Markup.button.callback("❌ حذف سؤال", "faqs_del")],
  [BackToMainBtn]
]);

const AdminsMenu = Markup.inlineKeyboard([
    [Markup.button.callback("عرض القائمة 📃", "admins_list")],
    [Markup.button.callback("➕ إضافة أدمن", "admins_add_start"), Markup.button.callback("✏️ تعديل أدمن", "admins_edit_list")],
    [Markup.button.callback("❌ حذف أدمن", "admins_del_list")],
    [BackToMainBtn]
]);

// --- Handlers ---
bot.start((ctx) => {
  clearState(ctx.from.id);
  const admin = (ctx.state as any).admin;
  ctx.reply("👋 **أهلاً يا ريس!**", { parse_mode: "Markdown", ...getMainMenu(admin) });
});
bot.command("menu", (ctx) => {
    clearState(ctx.from.id);
    const admin = (ctx.state as any).admin;
    ctx.reply("👋 **القائمة الرئيسية**", { parse_mode: "Markdown", ...getMainMenu(admin) });
});
bot.action("menu_main", (ctx) => {
  clearState(ctx.from!.id);
  const admin = (ctx.state as any).admin;
  ctx.editMessageText("👋 **القائمة الرئيسية**", { parse_mode: "Markdown", ...getMainMenu(admin) });
});
bot.action("cancel_action", (ctx) => {
    clearState(ctx.from!.id);
    const admin = (ctx.state as any).admin;
    ctx.editMessageText("🚫 **تم الإلغاء.**", { parse_mode: "Markdown", ...getMainMenu(admin) });
    ctx.answerCbQuery("Cancelled");
});

// --- Generic Menus ---
bot.action("menu_stats", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/stats`);
        if (res.data.success) {
            const { total, active, expiring, expired, newSubsToday, messagesToday, activeUsersToday } = res.data.data;
            const msg = `📊 **إحصائيات المنصة**\n━━━━━━━━━━━━━━━━\n\n` +
                        `👥 **إجمالي المشتركين:** ${total}\n` +
                        `✅ **اشتراكات نشطة:** ${active}\n` +
                        `🆕 **جديد اليوم:** ${newSubsToday}\n\n` +
                        `⚠️ **تنتهي قريباً (3 أيام):** ${expiring}\n` +
                        `❌ **منتهية:** ${expired}\n\n` +
                        `📈 **النشاط اليومي:**\n` +
                        `💬 رسائل المساعد: ${messagesToday}\n` +
                        `👤 طلاب متفاعلة اليوم: ${activeUsersToday}\n\n` +
                        `_آخر تحديث: ${new Date().toLocaleTimeString('en-EG', {hour:'2-digit', minute:'2-digit', hour12: true})}_`;
             await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[BackToMainBtn]]).reply_markup });
        }
    } catch (e: any) {
        console.error("Stats Error:", e);
        const err = e.response?.data?.error || e.message || "Connection Error";
        await ctx.answerCbQuery(`❌ Error: ${err}`);
    }
});
bot.action("menu_users", (ctx) => ctx.editMessageText("👥 **إدارة المشتركين**", { parse_mode: "Markdown", ...UsersMenu }));
bot.action("menu_system", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/settings`);
        const { botActive, replyTarget } = res.data.data || {};
        const isActive = botActive !== 'false';
        const isSubOnly = replyTarget === 'subscribers';

        const statusIcon = isActive ? "✅" : "🛑";
        const statusText = isActive ? "شغال" : "واقف";
        const targetIcon = isSubOnly ? "👥" : "🌍";
        const targetText = isSubOnly ? "مشتركين بس" : "الكل";

        const msg = `📜 **تعليمات النظام والتحكم**\n━━━━━━━━━━━━━━━━\n\n` +
                    `🔌 **حالة البوت:** ${statusIcon} ${statusText}\n` +
                    `🎯 **الرد على:** ${targetIcon} ${targetText}\n\n` +
                    `تحكم في إعدادات النظام من هنا 👇`;

        await ctx.editMessageText(msg, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`الوضع: ${isActive ? 'إيقاف 🛑' : 'تشغيل ✅'}`, "toggle_status"), Markup.button.callback(`الهدف: ${isSubOnly ? 'الكل 🌍' : 'مشتركين 👥'}`, "toggle_target")],
                [Markup.button.callback("عرض التعليمات 👀", "system_view"), Markup.button.callback("تعديل التعليمات ✏️", "system_edit")],
                [Markup.button.callback("🕰️ ساعات العمل", "hours_view")],
                [BackToMainBtn]
            ])
        });
    } catch (e) {
        console.error("System Menu Error:", e);
        ctx.answerCbQuery("Error loading settings");
    }
});

bot.action("toggle_status", async (ctx) => {
    try {
        // 1. Get current
        const getRes = await axios.get(`${config.apiBaseUrl}/settings`);
        const currentSettings = getRes.data.data || {};
        const currentActive = currentSettings.botActive !== 'false';

        // 2. Toggle
        const newActive = !currentActive;

        // 3. Save
        await axios.post(`${config.apiBaseUrl}/settings`, { ...currentSettings, botActive: String(newActive) });

        // 4. Refresh Menu
        // We reuse the logic by virtually calling menu_system, but editMessageText with same content might throw if not changed,
        // so we manually trigger the same flow or just call the handler if extracted.
        // For simplicity, we'll just re-run the menu_system logic or ask user to refresh.
        // Better: Re-render the menu.

        // Let's copy-paste the re-render logic for now or extract it.
        // To avoid code duplication, I'll essentially just re-run the fetching and editing.
        const res = await axios.get(`${config.apiBaseUrl}/settings`); // fetch again to be sure
        const { botActive, replyTarget } = res.data.data || {};
         const isActive = botActive !== 'false';
        const isSubOnly = replyTarget === 'subscribers';

        const statusIcon = isActive ? "✅" : "🛑";
        const statusText = isActive ? "شغال" : "واقف";
        const targetIcon = isSubOnly ? "👥" : "🌍";
        const targetText = isSubOnly ? "مشتركين بس" : "الكل";

        const msg = `📜 **تعليمات النظام والتحكم**\n━━━━━━━━━━━━━━━━\n\n` +
                    `🔌 **حالة البوت:** ${statusIcon} ${statusText}\n` +
                    `🎯 **الرد على:** ${targetIcon} ${targetText}\n\n` +
                    `تحكم في إعدادات النظام من هنا 👇`;

        await ctx.editMessageText(msg, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`الوضع: ${isActive ? 'إيقاف 🛑' : 'تشغيل ✅'}`, "toggle_status"), Markup.button.callback(`الهدف: ${isSubOnly ? 'الكل 🌍' : 'مشتركين 👥'}`, "toggle_target")],
                [Markup.button.callback("عرض التعليمات 👀", "system_view"), Markup.button.callback("تعديل التعليمات ✏️", "system_edit")],
                [Markup.button.callback("🕰️ ساعات العمل", "hours_view")],
                [BackToMainBtn]
            ])
        });
        await ctx.answerCbQuery(newActive ? "تم التشغيل ✅" : "تم الإيقاف 🛑");

    } catch (e) {
        console.error("Toggle Status Error:", e);
        ctx.answerCbQuery("Error toggling status");
    }
});

bot.action("toggle_target", async (ctx) => {
    try {
        const getRes = await axios.get(`${config.apiBaseUrl}/settings`);
        const currentSettings = getRes.data.data || {};
        const currentTarget = currentSettings.replyTarget || 'all';

        const newTarget = currentTarget === 'all' ? 'subscribers' : 'all';

        await axios.post(`${config.apiBaseUrl}/settings`, { ...currentSettings, replyTarget: newTarget });

        // Re-render
        const res = await axios.get(`${config.apiBaseUrl}/settings`);
        const { botActive, replyTarget } = res.data.data || {};
        const isActive = botActive !== 'false';
        const isSubOnly = replyTarget === 'subscribers';

        const statusIcon = isActive ? "✅" : "🛑";
        const statusText = isActive ? "شغال" : "واقف";
        const targetIcon = isSubOnly ? "👥" : "🌍";
        const targetText = isSubOnly ? "مشتركين بس" : "الكل";

        const msg = `📜 **تعليمات النظام والتحكم**\n━━━━━━━━━━━━━━━━\n\n` +
                    `🔌 **حالة البوت:** ${statusIcon} ${statusText}\n` +
                    `🎯 **الرد على:** ${targetIcon} ${targetText}\n\n` +
                    `تحكم في إعدادات النظام من هنا 👇`;

        await ctx.editMessageText(msg, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback(`الوضع: ${isActive ? 'إيقاف 🛑' : 'تشغيل ✅'}`, "toggle_status"), Markup.button.callback(`الهدف: ${isSubOnly ? 'الكل 🌍' : 'مشتركين 👥'}`, "toggle_target")],
                [Markup.button.callback("عرض التعليمات 👀", "system_view"), Markup.button.callback("تعديل التعليمات ✏️", "system_edit")],
                [Markup.button.callback("🕰️ ساعات العمل", "hours_view")],
                [BackToMainBtn]
            ])
        });
        await ctx.answerCbQuery(newTarget === 'subscribers' ? "مشتركين بس 👥" : "للجميع 🌍");

    } catch (e) {
        console.error("Toggle Target Error:", e);
        ctx.answerCbQuery("Error toggling target");
    }
});
bot.action("menu_faqs", (ctx) => ctx.editMessageText("❓ **إدارة الأسئلة**", { parse_mode: "Markdown", ...FaqsMenu }));
bot.action("menu_admins", (ctx) => ctx.editMessageText("👮 **إدارة الآدمنز**", { parse_mode: "Markdown", ...AdminsMenu }));

// --- Admin Management Flows ---

// 1. LIST
bot.action("admins_list", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success) {
            let msg = "📋 **قائمة الآدمنز**\n━━━━━━━━━━━━━━━━\n\n";
            config.adminIds.forEach(id => msg += `🔑 **Super Admin**\n🆔 \`${id}\`\n(صلاحيات كاملة)\n〰️〰️〰️〰️〰️\n`);
            if (res.data.data.length > 0) {
                res.data.data.forEach((a: any) => {
                    const roleName = RoleMap[a.role] || a.role;
                    msg += `👤 **${a.name || "بدون اسم"}**\n`;
                    msg += `🏷️ **الدور:** ${roleName}\n`;
                    msg += `🆔 \`${a.userId}\`\n`;
                    if(a.permissions?.length > 0) msg += `🔐 ${a.permissions.map((p:string)=>PermissionMap[p]||p).join(', ')}\n`;
                    msg += `〰️〰️〰️〰️〰️\n`;
                });
            } else { msg += "(مفيش آدمنز إضافيين)"; }
            await ctx.editMessageText(msg, { parse_mode: "Markdown", ...AdminsMenu });
        }
    } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.answerCbQuery(`❌ Error: ${err}`, { show_alert: true });
    }
});

// 2. ADD (Wizard)
bot.action("admins_add_start", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_ADD_ADMIN_ID', tempData: {} });
    ctx.editMessageText("👮 **إضافة أدمن جديد (1/4)**\n\nابعتلي **الآيدي (Telegrarm ID)** بتاعه.", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});
// (Text Handler below handles ID input -> Name input -> Role selection trigger)

bot.action(/add_role_(.+)/, (ctx) => {
    const role = ctx.match[1];
    const state = getState(ctx.from!.id);
    if (!state || state.action !== 'WAITING_ADD_ADMIN_ROLE') return;

    // Default Perms
    const perms = role === 'SUPER_ADMIN' ? [] : (role === 'EDITOR' ? ['MANAGE_USERS', 'MANAGE_CONTENT'] : ['MANAGE_USERS']);

    setState(ctx.from!.id, { ...state, action: 'WAITING_ADD_ADMIN_PERMS', tempData: { ...state.tempData, role, permissions: perms } });

    ctx.editMessageText(
        `🎭 الدور: **${RoleMap[role]}**\n\n🔐 **(4/4) حدد الصلاحيات:**\n(اضغط للتغيير، ثم اضغط حفظ)`,
        { parse_mode: "Markdown", ...getPermissionsKeyboard(perms, "add_perm", "add_admin_save") }
    );
});

bot.action(/add_perm_TOGGLE_(.+)/, (ctx) => {
    const perm = ctx.match[1];
    const state = getState(ctx.from!.id);
    if (!state || !state.tempData) return;

    const currentPerms = state.tempData.permissions || [];
    const newPerms = currentPerms.includes(perm) ? currentPerms.filter((p:string) => p !== perm) : [...currentPerms, perm];

    setState(ctx.from!.id, { ...state, tempData: { ...state.tempData, permissions: newPerms } });
    ctx.editMessageReplyMarkup(getPermissionsKeyboard(newPerms, "add_perm", "add_admin_save").reply_markup);
});

bot.action("add_admin_save", async (ctx) => {
    const state = getState(ctx.from!.id);
    if (!state || !state.tempData) return;
    const { id, name, role, permissions } = state.tempData;
    try {
        const res = await axios.post(`${config.apiBaseUrl}/admins`, { userId: id, name, role, permissions });
        if (res.data.success) {
            await ctx.editMessageText(`🎉 **تمت الإضافة بنجاح!**\n👤 ${name}\n🎭 ${RoleMap[role]}`, { parse_mode: "Markdown", ...AdminsMenu });
            clearState(ctx.from!.id);
        } else { await ctx.answerCbQuery("Failed: " + res.data.error); }
    } catch(e) { await ctx.answerCbQuery("Error"); }
});

// 3. EDIT (Flow)
bot.action("admins_edit_list", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success && res.data.data.length > 0) {
           const buttons = res.data.data.map((a: any) => [Markup.button.callback(`✏️ ${a.name || "بدون اسم"} (${RoleMap[a.role]?.split('(')[0] || a.role})`, `admin_select_edit_${a.userId}`)]);
           buttons.push([CancelBtn]);
           await ctx.editMessageText("✏️ **اختار الأدمن اللي عايز تعدله:**", { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
        } else {
            await ctx.answerCbQuery("مفيش آدمنز يتعدلوا!");
        }
    } catch(e) { await ctx.answerCbQuery("Error"); }
});

bot.action(/admin_select_edit_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        const target = res.data.data.find((a:any) => a.userId === userId);
        if (target) {
            setState(ctx.from!.id, { action: 'WAITING_EDIT_ADMIN_SELECT', tempData: { admin: target } });
            await ctx.editMessageText(`⚙️ **تعديل الأدمن:** ${target.name}`, { parse_mode: "Markdown", ...getEditAdminMenu(target) });
        } else { await ctx.answerCbQuery("Not found"); }
    } catch(e) { await ctx.answerCbQuery("Error"); }
});

bot.action("admins_edit_start", (ctx) => {
    // Legacy fallback (IDK if needed, but keeping logic clean) or redirect to list
    ctx.editMessageText("⚠️ استخدم القائمة لاختيار الأدمن.", { reply_markup: Markup.inlineKeyboard([[Markup.button.callback("القائمة", "admins_edit_list")]]).reply_markup });
});
// (Text Handler gets ID, fetches info, shows Edit Menu)

bot.action("edit_admin_name", (ctx) => {
    const state = getState(ctx.from!.id);
    setState(ctx.from!.id, { ...state, action: 'WAITING_EDIT_ADMIN_NAME' });
    ctx.editMessageText(`👤 **الاسم الحالي:** ${state?.tempData?.admin?.name}\n\nاكتب الاسم الجديد:`, { reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});

bot.action("edit_admin_role", (ctx) => {
    ctx.editMessageText("🎭 **اختار الدور الجديد:**", { parse_mode: "Markdown", ...getRoleKeyboard("edit_role") });
});
bot.action(/edit_role_(.+)/, async (ctx) => {
    const role = ctx.match[1];
    const state = getState(ctx.from!.id);
    try {
        await axios.patch(`${config.apiBaseUrl}/admins`, { userId: state?.tempData?.admin?.userId, role });
        // Refresh State
        state!.tempData.admin.role = role;
        ctx.editMessageText("✅ تم تحديث الدور!", { ...getEditAdminMenu(state?.tempData?.admin) });
    } catch(e) { ctx.answerCbQuery("Error"); }
});

bot.action("edit_admin_perms", (ctx) => {
    const state = getState(ctx.from!.id);
    const perms = state?.tempData?.admin?.permissions || [];
    ctx.editMessageText("🔐 **تعديل الصلاحيات:**", { ...getPermissionsKeyboard(perms, "edit_perm", "edit_perms_done") });
});
bot.action(/edit_perm_TOGGLE_(.+)/, async (ctx) => {
    const perm = ctx.match[1];
    const state = getState(ctx.from!.id);
    const current = state?.tempData?.admin?.permissions || [];
    const newPerms = current.includes(perm) ? current.filter((p:string)=>p!==perm) : [...current, perm];
    state!.tempData.admin.permissions = newPerms;
    ctx.editMessageReplyMarkup(getPermissionsKeyboard(newPerms, "edit_perm", "edit_perms_done").reply_markup);
});
bot.action("edit_perms_done", async (ctx) => {
    const state = getState(ctx.from!.id);
    try {
        await axios.patch(`${config.apiBaseUrl}/admins`, { userId: state?.tempData?.admin?.userId, permissions: state?.tempData?.admin?.permissions });
        ctx.editMessageText("✅ تم تحديث الصلاحيات!", { ...getEditAdminMenu(state?.tempData?.admin) });
    } catch(e) { ctx.answerCbQuery("Error"); }
});

const getEditAdminMenu = (admin: any) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(`👤 الاسم: ${admin.name}`, "edit_admin_name")],
        [Markup.button.callback(`🎭 الدور: ${RoleMap[admin.role] || admin.role}`, "edit_admin_role")],
        [Markup.button.callback(`🔐 الصلاحيات`, "edit_admin_perms")],
        [Markup.button.callback("🔙 رجوع للقائمة", "admins_list")]
    ]);
};


// --- Text Handler ---
bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const state = getState(userId);
    if (!state || !state.action) return;
    const text = ctx.message.text.trim();

    // Add Admin Flow
    if (state.action === 'WAITING_BROADCAST_MSG') {
      const msg = text;
      setState(userId, { action: 'WAITING_BROADCAST_CONFIRM', tempData: { msg } });
      await ctx.reply(
          `📢 **معاينة الرسالة:**\n\n\`${msg}\`\n\n⚠️ **متأكد إنك عايز تبعتها لكل الناس؟**`,
          {
              parse_mode: "Markdown",
              ...Markup.inlineKeyboard([
                  [Markup.button.callback("✅ نعم، ابعت حالاً", "broadcast_send")],
                  [CancelBtn]
              ])
          }
      );
      return;
  }

  if (state.action === 'WAITING_ADD_ADMIN_ID') {
        setState(userId, { action: 'WAITING_ADD_ADMIN_NAME', tempData: { id: text } });
        await ctx.reply(`✅ الآيدي: \`${text}\`\n\n👤 **(2/4) الاسم إيه؟**`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
        return;
    }
    if (state.action === 'WAITING_ADD_ADMIN_NAME') {
        setState(userId, { action: 'WAITING_ADD_ADMIN_ROLE', tempData: { ...state.tempData, name: text } });
        await ctx.reply(`✅ الاسم: ${text}\n\n🎭 **(3/4) اختار الدور:**`, { parse_mode: "Markdown", ...getRoleKeyboard("add_role") });
        return;
    }

    // Edit Admin Flow
    if (state.action === 'WAITING_EDIT_ADMIN_ID') {
        try {
            const res = await axios.get(`${config.apiBaseUrl}/admins`);
            const target = res.data.data.find((a:any) => a.userId === text);
            if (target) {
                setState(userId, { action: 'WAITING_EDIT_ADMIN_SELECT', tempData: { admin: target } });
                await ctx.reply(`⚙️ **تعديل الأدمن:** ${target.name}`, { parse_mode: "Markdown", ...getEditAdminMenu(target) });
            } else { await ctx.reply("❌ الآيدي ده مش موجود."); }
        } catch(e: any) {
            console.error(e);
            await ctx.reply(`❌ **خطأ:** ${e.message}`);
        }
        return;
    }
    if (state.action === 'WAITING_EDIT_ADMIN_NAME') {
        const state = getState(userId);
        try {
            await axios.patch(`${config.apiBaseUrl}/admins`, { userId: state?.tempData?.admin?.userId, name: text });
            state!.tempData.admin.name = text;
            setState(userId, { action: 'WAITING_EDIT_ADMIN_SELECT', tempData: state!.tempData });
            await ctx.reply("✅ تم تغيير الاسم!", { ...getEditAdminMenu(state!.tempData.admin) });
        } catch(e) { await ctx.reply("Error"); }
        return;
    }

    // ... (Existing Handlers for User/FAQ/System/DelAdmin) ...
    if (state.action === 'WAITING_DEL_ADMIN') {
        // Redundant with list flow, but keeping for safety if state persists
        return;
    }
   if (state.action === 'WAITING_ADD_USER_ID') {
      setState(userId, { action: 'WAITING_ADD_USER_NAME', tempData: { id: text } });
      await ctx.reply(`✅ تمام. الآيدي: \`${text}\`\n\n👤 **(خطوة 2/2)** اكتب اسم الطالب دلوقتي:`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
      return;
  }
  if (state.action === 'WAITING_ADD_USER_NAME') {
      setState(userId, { action: 'WAITING_ADD_USER_START_DATE', tempData: { ...state.tempData, name: text } });
      await ctx.reply(`✅ الاسم: ${text}\n\n📅 **(خطوة 3/3)** دخل تاريخ البداية (DD-MM-YYYY):\nأو اكتب "now" عشان يبدأ من النهاردة.`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
      return;
  }
  if (state.action === 'WAITING_ADD_USER_START_DATE') {
      let startDate = new Date();
      if (text.toLowerCase() !== 'now') {
          // Parse DD-MM-YYYY or DD/MM/YYYY
          const parts = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
          if (parts) {
              const day = parseInt(parts[1], 10);
              const month = parseInt(parts[2], 10) - 1; // Months are 0-indexed
              const year = parseInt(parts[3], 10);
              startDate = new Date(year, month, day);
          } else {
               await ctx.reply("⚠️ تاريخ غير صحيح. حاول تاني بصيغة (DD-MM-YYYY) مثلاً 25-12-2025 أو اكتب now.");
               return;
          }

          if (isNaN(startDate.getTime())) {
               await ctx.reply("⚠️ تاريخ غير صحيح. تأكد من الأرقام.");
               return;
          }
      }

      setState(userId, { action: 'WAITING_ADD_USER_DURATION', tempData: { ...state.tempData, startDate } });
      await ctx.reply(`✅ البداية: ${startDate.toLocaleDateString('en-GB')}\n\n⏳ **(خطوة 4/4)** دخل مدة الاشتراك بالأيام (مثلاً 30):`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
      return;
  }
  if (state.action === 'WAITING_ADD_USER_DURATION') {
      const days = parseInt(text);
      if (isNaN(days) || days <= 0) {
          await ctx.reply("⚠️ رقم غير صحيح. دخل رقم صحيح (أكبر من 0).");
          return;
      }

      const startDate = state.tempData.startDate || new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days);

      try {
        await axios.post(`${config.apiBaseUrl}/subscription`, {
            userId: state.tempData.id,
            name: state.tempData.name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });
        const dateOpt: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        await ctx.reply(`🎉 **تمت الإضافة بنجاح!**\n⏳ المدة: ${days} يوم\n📅 من: ${startDate.toLocaleDateString('ar-EG', dateOpt)}\n📅 لغاية: ${endDate.toLocaleDateString('ar-EG', dateOpt)}`, { parse_mode: "Markdown", ...UsersMenu });
        clearState(userId);
      } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.reply(`❌ **حدث خطأ:**\n\`${err}\``, { parse_mode: "Markdown" });
      }
      return;
  }
  if (state.action === 'WAITING_DEL_USER') {
      try {
        await axios.delete(`${config.apiBaseUrl}/subscription`, { params: { userId: text } });
        await ctx.reply(`🗑️ تم الحذف.`, { ...UsersMenu });
        clearState(userId);
      } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.reply(`❌ **حدث خطأ:**\n\`${err}\``, { parse_mode: "Markdown" });
      }
      return;
  }
  // --- Edit User Text Handlers ---
  if (state.action === 'WAITING_EDIT_USER_START_DATE') {
      if (text.toLowerCase() !== 'keep') {
          const parts = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
          if (parts) {
              const day = parseInt(parts[1], 10);
              const month = parseInt(parts[2], 10) - 1;
              const year = parseInt(parts[3], 10);
              state.tempData.startDate = new Date(year, month, day);
          } else {
               await ctx.reply("⚠️ تاريخ غير صحيح. حاول تاني بصيغة (DD-MM-YYYY) مثلاً 01-01-2025 أو اكتب keep.");
               return;
          }

          if (isNaN(state.tempData.startDate.getTime())) {
               await ctx.reply("⚠️ تاريخ غير صحيح. تأكد من الأرقام.");
               return;
          }
      }
      setState(userId, { action: 'WAITING_EDIT_USER_DURATION', tempData: state.tempData });
      await ctx.reply(`✅ تمام.\n\n⏳ **دخل المدة الجديدة (أيام):**\nأو اكتب "keep" عشان متغيرش تاريخ الانتهاء الحالي.`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
      return;
  }
  if (state.action === 'WAITING_EDIT_USER_DURATION') {
      const payload: any = { userId: state.tempData.id };

      // Handle Start Date
      if (state.tempData.startDate) {
          payload.startDate = state.tempData.startDate.toISOString();
      }

      // Handle End Date ( Duration )
      if (text.toLowerCase() !== 'keep') {
          const days = parseInt(text);
          if (isNaN(days) || days <= 0) {
              await ctx.reply("⚠️ رقم مش صحيح. اكتب رقم أو keep.");
              return;
          }
           // Calculate End Date based on (New Start Date OR Current Start???)
           // Logic: If updating duration, we usually mean "From Start Date"
           // Verification: We need the start date to calculate end date carefully.
           // However, simple approach: If start date was updated, use that. If not, we might need to fetch user?
           // Actually, simpler: Allow user to input End Date directly? No, duration is easier.
           // Let's assume: If start date is updated, duration starts from there.
           // If start date is KEEP, we need to know current start date to add duration?
           // OR we just ask for specific End Date?
           // Refined Plan: Just ask for End Date directly in Edit Mode?
           // User Request: "user can selet the data as well as editing it later"
           // Let's deduce End Date from Start + Duration.
           // If Start is KEEP, we need current start.
           // Fetch user data first in 'user_select_edit' would have been better.

           // Quick Fix: Fetch user now if needed.
           let baseStartDate = state.tempData.startDate;
           if (!baseStartDate) {
               // Need to fetch user to get their current start date
               try {
                   const res = await axios.get(`${config.apiBaseUrl}/subscription?userId=${state.tempData.id}`);
                   if (res.data.success && res.data.data) {
                       baseStartDate = new Date(res.data.data.startDate);
                   } else {
                       baseStartDate = new Date(); // Fallback
                   }
               } catch(e) { baseStartDate = new Date(); }
           }

           const newEnd = new Date(baseStartDate);
           newEnd.setDate(newEnd.getDate() + days);
           payload.endDate = newEnd.toISOString();
      }

      try {
        await axios.patch(`${config.apiBaseUrl}/subscription`, payload);
        await ctx.reply(`✅ **تم التعديل بنجاح!**`, { parse_mode: "Markdown", ...UsersMenu });
        clearState(userId);
      } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.reply(`❌ **حدث خطأ:**\n\`${err}\``, { parse_mode: "Markdown" });
      }
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
      } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.reply(`❌ **حدث خطأ:**\n\`${err}\``, { parse_mode: "Markdown" });
      }
      return;
  }
  if (state.action === 'WAITING_DEL_FAQ') {
      try {
        await axios.delete(`${config.apiBaseUrl}/faqs`, { params: { id: text } });
        await ctx.reply(`🗑️ تم الحذف.`, { ...FaqsMenu });
        clearState(userId);
      } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.reply(`❌ **حدث خطأ:**\n\`${err}\``, { parse_mode: "Markdown" });
      }
      return;
  }
  if (state.action === 'WAITING_SET_SYSTEM') {
      try {
        await axios.post(`${config.apiBaseUrl}/system-instruction`, { content: text });
        await ctx.reply("✅ تم التحديث.", { ...SystemMenu });
        clearState(userId);
      } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
      }
      return;
  }

  // Working Hours Text Handlers
  if (state.action === 'WAITING_SET_HOURS_START' || state.action === 'WAITING_SET_HOURS_END') {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM
      if (!timeRegex.test(text)) {
          await ctx.reply("⚠️ صيغة وقت غير صحيحة. لازم تكون `HH:MM` (مثال: `09:30`).", { parse_mode: "Markdown" });
          return;
      }

      const key = state.action === 'WAITING_SET_HOURS_START' ? 'aiWorkStart' : 'aiWorkEnd';
      const label = state.action === 'WAITING_SET_HOURS_START' ? 'البداية' : 'النهاية';

      try {
          await axios.post(`${config.apiBaseUrl}/settings`, { [key]: text });
          await ctx.reply(`✅ تم تحديث وقت ${label} إلى \`${text}\` بنجاح!`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[Markup.button.callback("🔙 رجوع", "hours_view")] ]).reply_markup });
          clearState(userId);
      } catch (e: any) {
          console.error("Settings Update Error:", e);
          await ctx.reply("❌ حدث خطأ أثناء الحفظ.");
      }
      return;
  }
});

// --- Users Management Handlers ---
bot.action(/users_list_(.+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    try {
        const res = await axios.get(`${config.apiBaseUrl}/subscription`);
        if (res.data.success) {
            const users = res.data.data;
            const perPage = 5;
            const maxPage = Math.ceil(users.length / perPage) - 1;
            const current = Math.min(Math.max(0, page), maxPage);
            const start = current * perPage;
            const chunk = users.slice(start, start + perPage);

            let msg = `👥 **قائمة المشتركين (${users.length})**\nصفحة ${current + 1} من ${maxPage + 1}\n━━━━━━━━━━━━━━━━\n`;
            chunk.forEach((u: any) => {
                const now = new Date();
                const startDate = new Date(u.startDate);
                const endDate = u.endDate ? new Date(u.endDate) : null;
                const isActive = startDate <= now && (!endDate || endDate >= now);
                const status = isActive ? "✅ نشط" : "🔴 منتهي";

                // Calculate remaining or elapsed days
                let timeInfo = "";
                if (endDate) {
                    const diffTime = endDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 0) {
                        timeInfo = `⏳ باقي: ${diffDays} يوم`;
                    } else {
                        timeInfo = `⚠️ انتهى من: ${Math.abs(diffDays)} يوم`;
                    }
                } else {
                    timeInfo = "♾️ اشتراك دائم";
                }

                msg += `👤 [${u.name || "مجهول"}](tg://user?id=${u.userId})\n`;
                msg += `🆔 \`${u.userId}\`\n`;
                msg += `📊 الحالة: ${status}\n`;
                msg += `${timeInfo}\n`;
                msg += `📅 البداية: ${startDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
                msg += `⏳ النهاية: ${endDate ? endDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "♾️ مدى الحياة"}\n`;
                msg += `〰️〰️〰️\n`;
            });

            const buttons = [];
            if (current > 0) buttons.push(Markup.button.callback("⬅️ سابق", `users_list_${current - 1}`));
            if (current < maxPage) buttons.push(Markup.button.callback("تالي ➡️", `users_list_${current + 1}`));

            await ctx.editMessageText(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard([buttons, [BackToMainBtn]]) });
        }
    } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.answerCbQuery(`❌ Error: ${err}`, { show_alert: true });
    }
});

bot.action("users_add_start", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_ADD_USER_ID' });
    ctx.editMessageText("👥 **إضافة مشترك جديد**\n\nابعتلي **الآيدي** بتاع الطالب.", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});

bot.action("users_del", (ctx) => {
    ctx.editMessageText("🔄 جاري تحميل القائمة...", { parse_mode: "Markdown", ...Markup.inlineKeyboard([[Markup.button.callback("فتح قائمة الحذف ❌", "users_del_list_0")]]) });
});

bot.action(/users_del_list_(.+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    try {
        const res = await axios.get(`${config.apiBaseUrl}/subscription`);
        if (res.data.success) {
            const users = res.data.data;
            const perPage = 5;
            const maxPage = Math.ceil(users.length / perPage) - 1;
            const current = Math.min(Math.max(0, page), maxPage);
            const start = current * perPage;
            const chunk = users.slice(start, start + perPage);

            const buttons = chunk.map((u:any) => [Markup.button.callback(`❌ حذف ${u.name || "مجهول"}`, `user_select_del_${u.userId}`)]);

            const navButtons = [];
            if (current > 0) navButtons.push(Markup.button.callback("⬅️ سابق", `users_del_list_${current - 1}`));
            if (current < maxPage) navButtons.push(Markup.button.callback("تالي ➡️", `users_del_list_${current + 1}`));
            if(navButtons.length > 0) buttons.push(navButtons);

            buttons.push([CancelBtn]);

            await ctx.editMessageText(`🗑️ **اختار المشترك لحذفه:**\nصفحة ${current + 1} من ${maxPage + 1}`, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
        }
    } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.answerCbQuery(`❌ Error: ${err}`, { show_alert: true });
    }
});

bot.action(/user_select_del_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    let details = "";
    try {
        const res = await axios.get(`${config.apiBaseUrl}/subscription?userId=${userId}`);
        if(res.data.success && res.data.data) {
            const u = res.data.data;
            const startDate = new Date(u.startDate);
            const endDate = u.endDate ? new Date(u.endDate) : null;
            details += `\n👤 الاسم: ${u.name || "مجهول"}`;
            details += `\n📅 البداية: ${startDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}`;
            details += `\n⏳ النهاية: ${endDate ? endDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : "مدى الحياة"}`;
        }
    } catch(e) {}

    await ctx.editMessageText(`⚠️ **متأكد إنك عايز تحذف المشترك ده؟**\n🆔 \`${userId}\`${details}`, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ نعم، احذف", `user_confirm_del_${userId}`)],
            [CancelBtn]
        ])
    });
});
bot.action(/user_confirm_del_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    try {
        await axios.delete(`${config.apiBaseUrl}/subscription`, { params: { userId } });
        await ctx.editMessageText("🗑️ **تم حذف المشترك بنجاح.**", { parse_mode: "Markdown", ...UsersMenu });
    } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.answerCbQuery(`❌ Error: ${err}`, { show_alert: true });
    }
});


// --- System Handlers ---
bot.action("system_view", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/system-instruction`);
        if (res.data.success && res.data.data) {
            const content = res.data.data.content || "لا يوجد محتوى";
            try {
                // Try Markdown first
                await ctx.editMessageText(`📜 **التعليمات الحالية:**\n\n\`${content}\``, { parse_mode: "Markdown", ...SystemMenu });
            } catch (mdError) {
                console.warn("Markdown failed, falling back to plain text:", mdError);
                // Fallback to plain text if Markdown fails (e.g. unescaped chars in content)
                await ctx.editMessageText(`📜 التعليمات الحالية (Plain Text):\n\n${content}`, { ...SystemMenu });
            }
        } else {
            await ctx.answerCbQuery("No data found");
        }
    } catch (e) {
        console.error("System View Error:", e);
        await ctx.answerCbQuery("Error fetching system");
    }
});

bot.action("system_edit", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_SET_SYSTEM' });
    ctx.editMessageText("✏️ **تعديل التعليمات**\n\nابعتلي النص الجديد:", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});



// --- Working Hours Handlers ---
bot.action("hours_view", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/settings`);
        const { aiWorkStart, aiWorkEnd } = res.data.data || {};
        const start = aiWorkStart || "غير محدد";
        const end = aiWorkEnd || "غير محدد";

        const msg = `🕰️ **ساعات العمل الحالية (توقيت مصر)**\n\n🟢 البداية: \`${start}\`\n🔴 النهاية: \`${end}\`\n\n⚠️ خارج هذه الأوقات، البوت لن يرد نهائياً (Silent Mode).`;

        await ctx.editMessageText(msg, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("تعديل البداية 🟢", "hours_set_start"), Markup.button.callback("تعديل النهاية 🔴", "hours_set_end")],
                [Markup.button.callback("🔙 رجوع", "menu_system")]
            ])
        });
    } catch (e: any) {
        console.error("Hours View Error:", e);
        ctx.answerCbQuery("Error fetching settings");
    }
});

bot.action("hours_set_start", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_SET_HOURS_START' });
    ctx.editMessageText("🟢 **تعديل وقت البداية**\n\nدخل الوقت بصيغة 24 ساعة (مثال: `08:00`).", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});

bot.action("hours_set_end", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_SET_HOURS_END' });
    ctx.editMessageText("🔴 **تعديل وقت النهاية**\n\nدخل الوقت بصيغة 24 ساعة (مثال: `23:00`).", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});

// --- Broadcast Handlers ---
bot.action("broadcast_start", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_BROADCAST_MSG' });
    ctx.editMessageText(
        "📢 **نظام الإذاعة**\n\nابعت الرسالة اللي عايز تبعتها لكل المشتركين.\n(نص فقط حالياً)",
        { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup }
    );
});

bot.action("broadcast_send", async (ctx) => {
    const state = getState(ctx.from!.id);
    if (!state || state.action !== 'WAITING_BROADCAST_CONFIRM' || !state.tempData.msg) return;

    const message = state.tempData.msg;

    try {
        await ctx.editMessageText("⏳ **جاري الإرسال...** (ممكن ياخد وقت لو العدد كبير)");

        // Call User Bot API
        const res = await axios.post(`http://localhost:${config.reloadPort}/broadcast`, { message });

        if (res.data.success) {
            await ctx.editMessageText(
                `✅ **تم الإرسال بنجاح!**\n\n` +
                `🎯 المستهدفين (Active): ${res.data.total}\n` +
                `📨 وصل: ${res.data.sent}\n` +
                `❌ فشل: ${res.data.failed}`,
                { parse_mode: "Markdown", ...SystemMenu }
            );
        } else {
             await ctx.editMessageText(`❌ فشل الإرسال: ${res.data.error}`, { ...SystemMenu });
        }
        clearState(ctx.from!.id);

    } catch (e: any) {
        console.error("Broadcast Logic Error:", e);
        const err = e.response?.data?.error || e.message;
        await ctx.editMessageText(`❌ Error: ${err}`, { ...SystemMenu });
    }
});

bot.action(/faqs_list_(.+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    try {
        const res = await axios.get(`${config.apiBaseUrl}/faqs`);
        if (res.data.success) {
            const faqs = res.data.data;
            const perPage = 3;
            const maxPage = Math.ceil(faqs.length / perPage) - 1;
            const current = Math.min(Math.max(0, page), maxPage);
            const start = current * perPage;
            const chunk = faqs.slice(start, start + perPage);

            let msg = `❓ **الأسئلة الشائعة (${faqs.length})**\nصفحة ${current + 1} من ${maxPage + 1}\n━━━━━━━━━━━━━━━━\n`;
            chunk.forEach((f: any) => {
                msg += `🔹 **س:** ${f.question}\n🔸 **ج:** ${f.answer}\n🆔 #${f.id}\n〰️〰️〰️\n`;
            });

            const buttons = [];
            if (current > 0) buttons.push(Markup.button.callback("⬅️ سابق", `faqs_list_${current - 1}`));
            if (current < maxPage) buttons.push(Markup.button.callback("تالي ➡️", `faqs_list_${current + 1}`));

            await ctx.editMessageText(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard([buttons, [BackToMainBtn]]) });
        }
    } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.answerCbQuery(`❌ Error: ${err}`, { show_alert: true });
    }
});

// --- Edit Users Handlers ---
bot.action(/users_edit_list_(.+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    try {
        const res = await axios.get(`${config.apiBaseUrl}/subscription`);
        if (res.data.success) {
            const users = res.data.data;
            const perPage = 5;
            const maxPage = Math.ceil(users.length / perPage) - 1;
            const current = Math.min(Math.max(0, page), maxPage);
            const start = current * perPage;
            const chunk = users.slice(start, start + perPage);

            let msg = `✏️ **اختار المشترك لتعديل اشتراكه:**\nصفحة ${current + 1} من ${maxPage + 1}\n━━━━━━━━━━━━━━━━\n`;

            // Build the buttons
            const buttons = [];

            chunk.forEach((u: any) => {
                const now = new Date();
                const startDate = new Date(u.startDate);
                const endDate = u.endDate ? new Date(u.endDate) : null;
                const isActive = startDate <= now && (!endDate || endDate >= now);
                const status = isActive ? "✅" : "🔴";

                // Add details to message
                msg += `👤 **${u.name || "مجهول"}** (${status})\n`;
                msg += `🆔 \`${u.userId}\`\n`;
                msg += `📅 ${startDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })} ➡️ ${endDate ? endDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : "مدى الحياة"}\n`;
                msg += `〰️〰️〰️\n`;

                buttons.push([Markup.button.callback(`✏️ ${u.name || "مجهول"} (${u.userId})`, `user_select_edit_${u.userId}`)]);
            });

            const navButtons = [];
            if (current > 0) navButtons.push(Markup.button.callback("⬅️ سابق", `users_edit_list_${current - 1}`));
            if (current < maxPage) navButtons.push(Markup.button.callback("تالي ➡️", `users_edit_list_${current + 1}`));
            if(navButtons.length > 0) buttons.push(navButtons);

            buttons.push([CancelBtn]);

            await ctx.editMessageText(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
        }
    } catch (e: any) {
        console.error("Error:", e);
        const err = e.response?.data?.error || e.message || "Unknown Error";
        await ctx.answerCbQuery(`❌ Error: ${err}`, { show_alert: true });
    }
});

bot.action(/user_select_edit_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    try {
        const res = await axios.get(`${config.apiBaseUrl}/subscription?userId=${userId}`);
        let userInfoMsg = "";
        if (res.data.success && res.data.data) {
             const u = res.data.data;
             const startDate = new Date(u.startDate);
             const endDate = u.endDate ? new Date(u.endDate) : null;

             userInfoMsg += `\n👤 المشترك: ${u.name || "مجهول"}`;
             userInfoMsg += `\n📅 البداية الحالية: ${startDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}`;
             userInfoMsg += `\n⏳ النهاية الحالية: ${endDate ? endDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : "مدى الحياة"}`;
        }

        setState(ctx.from!.id, { action: 'WAITING_EDIT_USER_START_DATE', tempData: { id: userId } });
        await ctx.editMessageText(`📅 **تعديل تاريخ الاشتراك**\n🆔 \`${userId}\`${userInfoMsg}\n\nدخل تاريخ البداية الجديد (DD-MM-YYYY):\nأو اكتب "keep" عشان متغيروش.`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
    } catch (e) {
        setState(ctx.from!.id, { action: 'WAITING_EDIT_USER_START_DATE', tempData: { id: userId } });
        await ctx.editMessageText(`📅 **تعديل تاريخ الاشتراك**\n🆔 \`${userId}\`\n\nدخل تاريخ البداية الجديد (DD-MM-YYYY):\nأو اكتب "keep" عشان متغيروش.`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
    }
});


// Add to Text Handler for Edit Flow
/*
// NOTE: I will add the text handlers for editing inside the main text handler block in a separate edit
// to avoid complex multi-block replacement.
*/

bot.action("faqs_add_start", (ctx) => {
    setState(ctx.from!.id, { action: 'WAITING_ADD_FAQ_Q' });
    ctx.editMessageText("❓ **سؤال جديد**\n\nابعتلي **نص السؤال**:", { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[CancelBtn]]).reply_markup });
});

bot.action("faqs_del", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/faqs`);
        if (res.data.success && res.data.data.length > 0) {
            const buttons = res.data.data.map((f: any) => [
                Markup.button.callback(`❌ ${f.question.substring(0, 30)}...`, `faq_select_del_${f.id}`)
            ]);
            buttons.push([CancelBtn]);
            await ctx.editMessageText("🗑️ **اختار السؤال اللي عايز تحذفه:**", { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
        } else { await ctx.answerCbQuery("مفيش أسئلة!"); }
    } catch (e) { await ctx.answerCbQuery("Error"); }
});

bot.action(/faq_select_del_(.+)/, (ctx) => {
    const id = ctx.match[1];
    ctx.editMessageText(`⚠️ **حذف السؤال ده نهائياً؟**`, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ حذف", `faq_confirm_del_${id}`)],
            [CancelBtn]
        ])
    });
});

bot.action(/faq_confirm_del_(.+)/, async (ctx) => {
    const id = ctx.match[1];
    try {
        await axios.delete(`${config.apiBaseUrl}/faqs`, { params: { id } });
        await ctx.editMessageText("🗑️ **تم حذف السؤال بنجاح.**", { parse_mode: "Markdown", ...FaqsMenu });
    } catch (e) { await ctx.answerCbQuery("Error"); }
});


bot.action("admins_del_list", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/admins`);
        if (res.data.success && res.data.data.length > 0) {
            const buttons = res.data.data.map((a: any) => [Markup.button.callback(`❌ ${a.name || "بدون اسم"}`, `admin_select_del_${a.userId}`)]);
            buttons.push([CancelBtn]);
            await ctx.editMessageText("🗑️ **اختار الأدمن اللي عايز تحذفه:**", { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
        } else { await ctx.answerCbQuery("مفيش آدمنز يتحذفوا!"); }
    } catch (e) { await ctx.answerCbQuery("Error"); }
});

bot.action(/admin_select_del_(.+)/, (ctx) => {
    const userId = ctx.match[1];
    ctx.editMessageText(`⚠️ **متأكد إنك عايز تحذف الأدمن ده؟**\n🆔 \`${userId}\``, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ نعم، احذف", `admin_confirm_del_${userId}`)],
            [CancelBtn]
        ])
    });
});

bot.action(/admin_confirm_del_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    try {
        await axios.delete(`${config.apiBaseUrl}/admins`, { params: { userId } });
        await ctx.editMessageText("🗑️ **تم الحذف بنجاح.**", { parse_mode: "Markdown", ...AdminsMenu });
    } catch (e) { await ctx.answerCbQuery("Error"); }
});


bot.action("menu_stats", async (ctx) => {
    try {
        const res = await axios.get(`${config.apiBaseUrl}/stats`);
        if (res.data.success) {
            const { sessionsCount, messagesCount, instructionsCount, subscriptionsCount } = res.data.data;
            const subBar = createProgressBar(subscriptionsCount, 100);
            await ctx.editMessageText(`📊 **إحصائيات البوت**\n\n👥 **الجلسات:** \`${sessionsCount}\`\n💬 **الرسائل:** \`${messagesCount}\`\n✅ **المشتركين:** \`${subscriptionsCount}\`\n[${subBar}]`, { parse_mode: "Markdown", reply_markup: Markup.inlineKeyboard([[BackToMainBtn]]).reply_markup });
        }
    } catch (e) { await ctx.answerCbQuery("Error"); }
});

bot.launch().then(() => console.log("🚀 Admin Bot Pro (Advanced) Started!"));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
