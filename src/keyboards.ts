import { Markup } from 'telegraf';

export const mainMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('👤 My Account', 'my_account')],
  [Markup.button.callback('ℹ️ Help', 'help')],
]);

export const pendingMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('🔄 Refresh', 'refresh_status')],
  [Markup.button.url('📞 Contact Admin', process.env.SUPPORT_CONTACT || 'https://t.me/Dannywest223')],
]);

export const adminPanel = () => Markup.inlineKeyboard([
  [Markup.button.callback('📢 Send Announcement', 'admin_announcement')],
  [Markup.button.callback('🔁 Auto-Repeat', 'admin_autorepeat')],
  [Markup.button.callback('⏹️ Stop Repeating', 'admin_stoprepeat')],
  [Markup.button.url('➕ Add Bot to Group', `https://t.me/${process.env.BOT_USERNAME || 'jonathan5432_bot'}?startgroup=true`)],
  [Markup.button.callback('🔗 Share Bot Link', 'admin_share_link')],
  [Markup.button.callback('👥 Groups', 'admin_groups')],
  [Markup.button.callback('👤 Users', 'admin_users')],
  [Markup.button.callback('⏳ Pending', 'admin_pending')],
  [Markup.button.callback('📊 Stats', 'admin_stats')],
  [Markup.button.callback('👑 Admins', 'admin_manage')],
  [Markup.button.callback('❌ Close', 'admin_close')],
]);

export const announcementMenu = () => Markup.inlineKeyboard([
  [Markup.button.callback('📝 Text Only', 'announce_text')],
  [Markup.button.callback('🖼️ Text + Photo', 'announce_photo')],
  [Markup.button.callback('◀️ Cancel', 'cancel')],
]);

export const userActions = (userId: string, status: string) => {
  const buttons = [];
  if (status === 'pending') {
    buttons.push(Markup.button.callback('✅ Approve', `approve_${userId}`));
    buttons.push(Markup.button.callback('🚫 Ban', `ban_${userId}`));
  } else if (status === 'approved') {
    buttons.push(Markup.button.callback('🚫 Ban', `ban_${userId}`));
  } else if (status === 'banned') {
    buttons.push(Markup.button.callback('♻️ Unban', `unban_${userId}`));
  }
  return Markup.inlineKeyboard([buttons, [Markup.button.callback('◀️ Back', 'admin_back')]]);
};

export const backButton = () => Markup.inlineKeyboard([
  [Markup.button.callback('◀️ Back', 'admin_back')]
]);

export const confirmBroadcast = () => Markup.inlineKeyboard([
  [Markup.button.callback('✅ Send Once', 'confirm_broadcast')],
  [Markup.button.callback('🔁 Send Every 10 Min', 'confirm_repeat')],
  [Markup.button.callback('❌ Cancel', 'cancel_broadcast')]
]);

export const stopRepeatKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('⏹️ Stop Repeating', 'stop_repeat')],
  [Markup.button.callback('❌ Cancel', 'cancel')]
]);

export const groupListKeyboard = (groups: any[]) => {
  const buttons = groups.map(g => 
    Markup.button.callback(`📢 ${g.chat_title}`, `group_${g.id}`)
  );
  return Markup.inlineKeyboard([
    ...buttons.reduce((acc, btn, i) => {
      if (i % 2 === 0) acc.push([]);
      acc[acc.length - 1].push(btn);
      return acc;
    }, [] as any[]),
    [Markup.button.callback('🔄 Refresh Groups', 'refresh_groups')],
    [Markup.button.callback('◀️ Back', 'admin_back')],
  ]);
};

// Share link keyboard (shows shareable link)
export const shareLinkKeyboard = (botUsername: string) => Markup.inlineKeyboard([
  [Markup.button.url(
    '📤 Open Share Link', 
    `https://t.me/share/url?url=https://t.me/${botUsername}?startgroup=true&text=Add%20this%20bot%20to%20your%20group%20for%20announcements!`
  )],
  [Markup.button.callback('◀️ Back', 'admin_back')]
]);