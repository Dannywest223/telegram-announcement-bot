import { Telegraf, session, Context, Markup } from 'telegraf';
import * as db from './database';
import * as services from './services';
import { 
  mainMenu, pendingMenu, adminPanel, userActions, backButton, 
  confirmBroadcast, announcementMenu, groupListKeyboard
} from './keyboards';
import { supabase } from './database';
import { logger } from './utils';

// Define extended context with session
interface SessionData {
  broadcast?: boolean;
  broadcastMessage?: string;
  banUserId?: string;
  announcement?: boolean;
  announcementType?: 'text' | 'photo';
  announcementText?: string;
  announcementPhoto?: string;
  autoRepeat?: boolean;
}

interface BotContext extends Context {
  session?: SessionData;
}

// Initialize bot
const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN!);

// ===== MIDDLEWARE =====
bot.use(session());

// Global error handler
bot.use(async (ctx, next) => {
  try { 
    await next(); 
  } 
  catch (error) {
    console.error('❌ Error in middleware:', error);
    await ctx.reply('An error occurred. Please try again.').catch(() => {});
  }
});

// Log all incoming updates
bot.use(async (ctx, next) => {
  console.log(`📨 Received update: ${ctx.updateType}`);
  if (ctx.message && 'text' in ctx.message) {
    console.log(`📝 Message: ${ctx.message.text || 'non-text'}`);
  }
  if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
    console.log(`🔘 Callback: ${ctx.callbackQuery.data}`);
  }
  await next();
});

// ===== ADMIN CHECK =====
async function requireAdmin(ctx: BotContext, next: () => Promise<void>) {
  if (!ctx.from) {
    await ctx.reply('Unable to identify you.');
    return;
  }
  const isAdmin = await db.isAdmin(ctx.from.id);
  if (!isAdmin) {
    await ctx.reply('⛔ Admin access required.');
    return;
  }
  await next();
}

// ===== GROUP HANDLER =====
bot.on('my_chat_member', async (ctx) => {
  const update = ctx.update.my_chat_member;
  if (!update) return;

  const chat = update.chat;
  const newStatus = update.new_chat_member.status;

  if (chat.type === 'private') {
    return;
  }

  if (newStatus === 'member' || newStatus === 'administrator') {
    const groupId = chat.id.toString();
    // @ts-ignore
    const groupTitle = chat.title || 'Unknown Group';
    // @ts-ignore
    const groupUsername = chat.username || null;
    const adminId = ctx.from?.id.toString() || '';

    const user = await db.findUser(parseInt(adminId));
    if (!user) return;

    try {
      const existingGroup = await db.getGroupByChatId(groupId);
      if (!existingGroup) {
        await db.addGroup(groupId, groupTitle, groupUsername, user.id);
        await db.logAction('group_added', user.id, adminId, { groupId, groupTitle });
        logger.info(`✅ Bot added to group: ${groupTitle} (${groupId})`);
      }
    } catch (error) {
      logger.error('Error adding group:', error);
    }
  }

  if (newStatus === 'kicked' || newStatus === 'left') {
    const groupId = chat.id.toString();
    try {
      await db.removeGroup(groupId);
      // @ts-ignore
      logger.info(`❌ Bot removed from group: ${chat.title || 'Unknown'}`);
    } catch (error) {
      logger.error('Error removing group:', error);
    }
  }
});

// ===== COMMANDS =====
bot.command('start', async (ctx) => {
  console.log('📝 /start command received from:', ctx.from?.id);
  try {
    const user = await services.registerUser(ctx);
    await db.initializeOwner();

    if (user.status === 'pending') {
      await ctx.reply(
        '👋 Welcome!\n\nYour account is pending approval.\nYou\'ll be notified when approved.',
        pendingMenu()
      );
    } else if (user.status === 'approved') {
      await ctx.reply('👋 Welcome back! You have full access.', mainMenu());
    } else if (user.status === 'banned') {
      await ctx.reply('🚫 Your access has been revoked.');
    }
    console.log('✅ /start response sent to:', ctx.from?.id);
  } catch (error) {
    console.error('❌ Error in /start:', error);
    await ctx.reply('An error occurred. Please try again.');
  }
});

bot.command('admin', requireAdmin, async (ctx) => {
  console.log('📝 /admin command received from:', ctx.from?.id);
  try {
    await ctx.reply('⚙️ Admin Panel\n\nSelect an option:', adminPanel());
    console.log('✅ /admin response sent to:', ctx.from?.id);
  } catch (error) {
    console.error('❌ Error in /admin:', error);
    await ctx.reply('An error occurred. Please try again.');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    'ℹ️ Help\n\n' +
    'Commands:\n' +
    '/start - Register\n' +
    '/help - This message\n' +
    '/account - Your info\n' +
    '/admin - Admin panel (admins only)\n' +
    '/groups - View all groups (admin only)\n' +
    '/ping - Check if bot is alive\n\n' +
    '🔊 Announcement Bot Features:\n' +
    '• Admins send messages to ALL groups at once\n' +
    '• Auto-repeat messages every 10 minutes\n' +
    '• Attach photos to announcements\n' +
    '• Track users who use the bot\n' +
    '• Ban users if needed',
    mainMenu()
  );
});

bot.command('ping', async (ctx) => {
  await ctx.reply('🏓 Pong! Bot is alive and responding!');
});

bot.command('test', async (ctx) => {
  await ctx.reply(`✅ Bot is working! Your ID: ${ctx.from.id}`);
});

bot.command('account', async (ctx) => {
  const user = await db.findUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first.');
  
  await ctx.reply(
    `👤 My Account\n\n` +
    `Name: ${user.first_name || 'N/A'}\n` +
    `Username: @${user.username || 'N/A'}\n` +
    `Status: ${user.status}\n` +
    `Registered: ${new Date(user.created_at).toLocaleDateString()}`,
    mainMenu()
  );
});

bot.command('groups', requireAdmin, async (ctx) => {
  await showGroups(ctx);
});

// ===== CALLBACKS =====
bot.action('my_account', async (ctx) => {
  await ctx.answerCbQuery();
  const user = await db.findUser(ctx.from.id);
  await ctx.reply(
    `👤 My Account\n\nName: ${user?.first_name || 'N/A'}\nStatus: ${user?.status || 'N/A'}`,
    mainMenu()
  );
});

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('ℹ️ Use /help for commands.');
});

bot.action('refresh_status', async (ctx) => {
  await ctx.answerCbQuery();
  const user = await db.findUser(ctx.from.id);
  if (user?.status === 'approved') {
    await ctx.reply('✅ Your access has been approved!', mainMenu());
  } else {
    await ctx.reply('⏳ Still pending approval.');
  }
});

// ===== ADMIN CALLBACKS =====
bot.action(/admin_.*/, requireAdmin, async (ctx) => {
  await ctx.answerCbQuery();
  
  const action = ctx.callbackQuery && 'data' in ctx.callbackQuery 
    ? ctx.callbackQuery.data 
    : '';

  console.log('📝 Admin action:', action);

  if (action === 'admin_announcement') {
    ctx.session = ctx.session || {};
    ctx.session.announcement = true;
    await ctx.reply(
      '📢 Send Announcement\n\n' +
      'What type of announcement do you want to send?',
      announcementMenu()
    );
  }

  else if (action === 'admin_autorepeat') {
    ctx.session = ctx.session || {};
    ctx.session.autoRepeat = true;
    await ctx.reply(
      '🔁 Auto-Repeat Message\n\n' +
      'Send the message you want the bot to repeat every 10 minutes.\n\n' +
      '⚠️ The bot will send this to ALL groups every 10 minutes until you stop it.'
    );
  }

  else if (action === 'admin_stoprepeat') {
    services.stopRepeatingMessage();
    await db.stopRepeatingMessage();
    await ctx.reply('⏹️ Auto-repeat stopped successfully!\n\nThe bot will no longer repeat messages.');
  }

  else if (action === 'admin_groups') {
    await showGroups(ctx);
  }

  else if (action === 'admin_users') {
    const users = await db.getAllUsers();
    if (users.length === 0) return ctx.reply('No users found.', backButton());
    
    const msg = users.slice(0, 20).map(u => 
      `👤 ${u.first_name || 'Unknown'} @${u.username || 'N/A'} - ${u.status}`
    ).join('\n');
    await ctx.reply(`👥 All Users (${users.length}):\n\n${msg}`, backButton());
  }

  else if (action === 'admin_pending') {
    const users = await db.getUsersByStatus('pending');
    if (users.length === 0) return ctx.reply('No pending users found.', backButton());
    
    for (const user of users.slice(0, 5)) {
      await ctx.reply(
        `👤 ${user.first_name || 'Unknown'} @${user.username || 'N/A'}\nID: ${user.telegram_id}\nRegistered: ${new Date(user.created_at).toLocaleDateString()}`,
        userActions(user.id, 'pending')
      );
    }
    if (users.length > 5) {
      await ctx.reply(`Showing 5 of ${users.length} pending users.`, backButton());
    }
  }

  else if (action === 'admin_stats') {
    const stats = await db.getStats();
    const groups = await db.getGroups();
    const activeRepeat = await db.getActiveRepeatingMessage();
    await ctx.reply(
      `📊 Statistics\n\n` +
      `👥 Users:\n` +
      `   Total: ${stats.total}\n` +
      `   Pending: ${stats.pending}\n` +
      `   Approved: ${stats.approved}\n` +
      `   Banned: ${stats.banned}\n\n` +
      `📢 Groups: ${groups.length}\n\n` +
      `🔁 Auto-Repeat: ${activeRepeat && activeRepeat.is_active ? '✅ Active' : '❌ Inactive'}`,
      backButton()
    );
  }

  else if (action === 'admin_manage') {
    const admins = await db.getAllAdmins();
    let msg = '👑 Admins\n\n';
    for (const a of admins) {
      const user = await db.findUser(a.telegram_id);
      msg += `- ${user?.first_name || 'Unknown'} (${a.telegram_id}) - ${a.role}\n`;
    }
    msg += '\nℹ️ To add an admin: /addadmin TELEGRAM_ID';
    await ctx.reply(msg, backButton());
  }

  else if (action === 'admin_back') {
    await ctx.reply('⚙️ Admin Panel\n\nSelect an option:', adminPanel());
  }

  else if (action === 'admin_close') {
    await ctx.deleteMessage();
  }

  else if (action === 'refresh_groups') {
    await ctx.answerCbQuery('Refreshing...');
    await showGroups(ctx);
  }
});

// ===== ANNOUNCEMENT HANDLERS =====
bot.action('announce_text', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session = ctx.session || {};
  ctx.session.announcementType = 'text';
  ctx.session.announcement = true;
  await ctx.reply('📝 Send me the text for your announcement:');
});

bot.action('announce_photo', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session = ctx.session || {};
  ctx.session.announcementType = 'photo';
  ctx.session.announcement = true;
  await ctx.reply('🖼️ Send me the photo, then the text:');
});

// ===== USER MANAGEMENT =====
bot.action(/approve_(.+)/, requireAdmin, async (ctx) => {
  const userId = ctx.match[1];
  console.log(`📝 Approving user with ID: ${userId}`);
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error || !user) {
    console.error('❌ User not found:', error);
    return ctx.answerCbQuery('❌ User not found');
  }
  
  try {
    await services.approveUser(user.telegram_id, ctx.from.id.toString());
    await ctx.answerCbQuery('✅ Approved!');
    await ctx.reply(`✅ ${user.first_name || 'User'} approved successfully!`);
    
    try {
      await ctx.telegram.sendMessage(
        user.telegram_id, 
        '✅ Access Approved!\n\nYour access has been approved.\nUse /start to get started.'
      );
    } catch (e) {
      console.log(`⚠️ Could not notify user ${user.telegram_id}`);
    }
  } catch (error) {
    console.error('❌ Error approving user:', error);
    await ctx.answerCbQuery('❌ Error approving user');
  }
});

bot.action(/ban_(.+)/, requireAdmin, async (ctx) => {
  const userId = ctx.match[1];
  console.log(`📝 Banning user with ID: ${userId}`);
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error || !user) {
    console.error('❌ User not found:', error);
    return ctx.answerCbQuery('❌ User not found');
  }
  
  if (!ctx.session) ctx.session = {};
  ctx.session.banUserId = user.telegram_id.toString();
  await ctx.answerCbQuery('📝 Enter ban reason');
  await ctx.reply(`📝 Enter ban reason for ${user.first_name || 'User'} (or /skip):`);
});

bot.action(/unban_(.+)/, requireAdmin, async (ctx) => {
  const userId = ctx.match[1];
  console.log(`📝 Unbanning user with ID: ${userId}`);
  
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error || !user) {
    console.error('❌ User not found:', error);
    return ctx.answerCbQuery('❌ User not found');
  }
  
  try {
    await services.unbanUser(user.telegram_id, ctx.from.id.toString());
    await ctx.answerCbQuery('♻️ Unbanned!');
    await ctx.reply(`♻️ ${user.first_name || 'User'} unbanned successfully!`);
    
    try {
      await ctx.telegram.sendMessage(
        user.telegram_id,
        '♻️ Access Restored\n\nYour access has been restored.\nUse /start to get started.'
      );
    } catch (e) {
      console.log(`⚠️ Could not notify user ${user.telegram_id}`);
    }
  } catch (error) {
    console.error('❌ Error unbanning user:', error);
    await ctx.answerCbQuery('❌ Error unbanning user');
  }
});

// ===== TEXT HANDLERS =====
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const session = ctx.session || {};

  console.log(`📝 Text received: ${text}`);

  // Handle ban reason
  if (session.banUserId) {
    if (text === '/skip') {
      await services.banUser(parseInt(session.banUserId), ctx.from.id.toString());
      await ctx.reply('🚫 User banned!');
    } else if (text === '/cancel') {
      await ctx.reply('❌ Ban cancelled.');
    } else {
      await services.banUser(parseInt(session.banUserId), ctx.from.id.toString(), text);
      await ctx.reply(`🚫 User banned! Reason: ${text}`);
    }
    delete session.banUserId;
    return;
  }

  // Handle admin announcement text
  if (session.announcement && session.announcementType === 'text') {
    session.announcementText = text;
    await ctx.reply(
      `📢 Announcement Preview\n\n${text}\n\n` +
      `How do you want to send this?`,
      confirmBroadcast()
    );
    session.announcement = false;
    return;
  }

  // Handle auto-repeat message text
  if (session.autoRepeat) {
    session.announcementText = text;
    await ctx.reply(
      `🔁 Auto-Repeat Preview\n\n${text}\n\n` +
      `⚠️ This will be sent to ALL groups every 10 minutes.\n\n` +
      `Start auto-repeat?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔁 Start Repeating', 'confirm_repeat')],
        [Markup.button.callback('❌ Cancel', 'cancel_broadcast')]
      ])
    );
    delete session.autoRepeat;
    return;
  }

  // Handle broadcast
  if (session.broadcast) {
    if (text === '/cancel') {
      delete session.broadcast;
      return ctx.reply('❌ Broadcast cancelled.');
    }
    session.broadcastMessage = text;
    await ctx.reply(`📤 Broadcast Preview:\n\n${text}\n\nSend this to all approved users?`, confirmBroadcast());
    return;
  }

  // Handle /addadmin command
  if (text.startsWith('/addadmin')) {
    const isOwner = await db.isOwner(ctx.from.id);
    if (!isOwner) {
      return ctx.reply('⛔ Only the bot owner can add admins.');
    }
    
    const parts = text.split(' ');
    if (parts.length < 2) {
      return ctx.reply('Usage: /addadmin TELEGRAM_ID');
    }
    
    const newAdminId = parseInt(parts[1]);
    if (isNaN(newAdminId)) {
      return ctx.reply('❌ Please provide a valid Telegram ID (number).');
    }
    
    try {
      const user = await db.findUser(newAdminId);
      if (!user) {
        return ctx.reply('❌ User not found. They need to /start the bot first.');
      }
      
      await db.addAdmin(user.id, newAdminId);
      await ctx.reply(`✅ ${user.first_name || 'User'} (${newAdminId}) is now an admin!`);
      
      try {
        await ctx.telegram.sendMessage(
          newAdminId,
          '👑 You have been made an administrator of this bot!\nUse /admin to access the admin panel.'
        );
      } catch (e) {}
    } catch (error: any) {
      await ctx.reply(`❌ Error: ${error.message}`);
    }
    return;
  }
});

// ===== PHOTO HANDLER =====
bot.on('photo', async (ctx) => {
  const session = ctx.session || {};
  if (session.announcement && session.announcementType === 'photo') {
    const photo = ctx.message.photo?.pop();
    if (photo) {
      session.announcementPhoto = photo.file_id;
      await ctx.reply('📝 Now send me the text for the announcement:');
    }
  }
});

// ===== CONFIRMATION HANDLERS =====
bot.action('confirm_broadcast', requireAdmin, async (ctx) => {
  const session = ctx.session || {};
  
  // Admin announcement - Send Once
  if (session.announcementText) {
    const text = session.announcementText;
    const photo = session.announcementPhoto;

    if (!text) {
      return ctx.reply('No announcement text found.');
    }

    await ctx.answerCbQuery('📤 Sending announcement...');

    try {
      const result = await services.sendAnnouncementToGroups(bot, text, photo);
      await ctx.reply(
        `✅ Announcement Sent!\n\n` +
        `📤 Sent to: ${result.sent} groups\n` +
        `❌ Failed: ${result.failed} groups`
      );
      await db.logAction('announcement_sent', undefined, ctx.from.id.toString(), { 
        text, 
        hasPhoto: !!photo,
        groups: result.sent + result.failed,
        sent: result.sent,
        failed: result.failed
      });
    } catch (error) {
      console.error('❌ Error sending announcement:', error);
      await ctx.reply('❌ Error sending announcement.');
    }

    delete session.announcement;
    delete session.announcementText;
    delete session.announcementPhoto;
    delete session.announcementType;
    delete session.broadcast;
    delete session.broadcastMessage;
    return;
  }

  // Broadcast
  const message = session.broadcastMessage;
  if (message) {
    await ctx.answerCbQuery('📤 Sending broadcast...');
    
    try {
      const results = await services.sendBroadcast(bot, message, ctx.from.id.toString());
      await ctx.reply(
        `✅ Broadcast Complete!\n\n` +
        `📤 Sent: ${results.sent}\n` +
        `❌ Failed: ${results.failed}\n` +
        `🚫 Blocked: ${results.blocked}`
      );
    } catch (error) {
      console.error('❌ Broadcast error:', error);
      await ctx.reply('❌ An error occurred while sending the broadcast.');
    }
    
    if (ctx.session) {
      delete ctx.session.broadcast;
      delete ctx.session.broadcastMessage;
    }
  }
});

// ===== AUTO-REPEAT CONFIRMATION =====
bot.action('confirm_repeat', requireAdmin, async (ctx) => {
  const session = ctx.session || {};
  const text = session.announcementText;
  const photo = session.announcementPhoto;

  if (!text) {
    return ctx.reply('No message found. Please start over with /admin → Auto-Repeat');
  }

  await ctx.answerCbQuery('🔁 Starting auto-repeat...');

  try {
    const user = await db.findUser(ctx.from.id);
    await db.createRepeatingMessage(text, photo || null, user?.id || '', 10);
    services.startRepeatingMessage(bot, text, photo || null, 10);
    
    await ctx.reply(
      `🔁 Auto-Repeat Started!\n\n` +
      `📢 The bot will send this message to ALL groups every 10 minutes.\n\n` +
      `To stop: use /admin → "⏹️ Stop Repeating"\n\n` +
      `Message:\n${text}`
    );
    await db.logAction('auto_repeat_started', undefined, ctx.from.id.toString(), { 
      text, hasPhoto: !!photo, interval: 10
    });
  } catch (error) {
    console.error('❌ Error starting repeat:', error);
    await ctx.reply('❌ Error starting auto-repeat.');
  }

  delete session.announcement;
  delete session.announcementText;
  delete session.announcementPhoto;
  delete session.announcementType;
});

// ===== STOP REPEAT HANDLER =====
bot.action('stop_repeat', requireAdmin, async (ctx) => {
  await ctx.answerCbQuery('⏹️ Stopping...');
  services.stopRepeatingMessage();
  await db.stopRepeatingMessage();
  await db.logAction('auto_repeat_stopped', undefined, ctx.from.id.toString(), {});
  await ctx.reply('⏹️ Auto-repeat has been stopped.\n\nThe bot will no longer repeat messages.');
});

bot.action('cancel_broadcast', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('❌ Cancelled.');
  if (ctx.session) {
    delete ctx.session.announcement;
    delete ctx.session.announcementText;
    delete ctx.session.announcementPhoto;
    delete ctx.session.announcementType;
    delete ctx.session.broadcast;
    delete ctx.session.broadcastMessage;
    delete ctx.session.autoRepeat;
  }
});

bot.action('cancel', async (ctx) => {
  await ctx.answerCbQuery('Cancelled');
  await ctx.deleteMessage();
});

// ===== HELPER FUNCTIONS =====
async function showGroups(ctx: Context) {
  const groups = await db.getGroups();
  
  if (groups.length === 0) {
    return ctx.reply(
      '📭 No Groups Found\n\n' +
      'Add me to a group and I\'ll track it!\n' +
      'Just add me as a member and I\'ll start tracking.'
    );
  }

  let message = '👥 Groups I\'m In\n\n';
  for (const group of groups) {
    message += `📌 ${group.chat_title}\n`;
    if (group.chat_username) {
      message += `   @${group.chat_username}\n`;
    }
    message += `   ID: ${group.chat_id}\n\n`;
  }

  await ctx.reply(
    message + `\nTotal Groups: ${groups.length}`,
    groupListKeyboard(groups)
  );
}

// ===== START BOT =====
export function startBot() {
  console.log('🔧 Starting bot...');
  console.log('📡 Connecting to Telegram...');
  
  bot.launch({
    dropPendingUpdates: true
  }).then(async () => {
    console.log('✅ Bot started successfully!');
    console.log(`🤖 Bot username: ${bot.botInfo?.username || 'unknown'}`);
    console.log('📢 Announcement Bot is ready!');
    console.log('📡 Polling for updates...');
    console.log('👑 Admins can use /admin for announcements');
    console.log('🔁 Auto-repeat available in admin panel');

    // Auto-resume any active repeating message on startup
    try {
      const active = await db.getActiveRepeatingMessage();
      if (active && active.is_active) {
        services.startRepeatingMessage(
          bot, 
          active.message, 
          active.photo_url, 
          active.interval_minutes || 10
        );
        console.log(`🔁 Auto-resumed repeating message (every ${active.interval_minutes || 10} min)`);
      }
    } catch (error) {
      console.error('Error resuming repeat:', error);
    }
  }).catch((error) => {
    console.error('❌ Failed to start bot:', error);
    console.error('❌ Error details:', error.message);
    if (error.response) {
      console.error('❌ Response:', error.response);
    }
  });
  
  return bot;
}

export { bot };