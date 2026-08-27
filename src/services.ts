import { Context } from 'telegraf';
import * as db from './database';

interface BotContext extends Context {
  session?: {
    broadcast?: boolean;
    broadcastMessage?: string;
    banUserId?: string;
    announcement?: boolean;
    announcementType?: 'text' | 'photo';
    announcementText?: string;
    announcementPhoto?: string;
  };
}

export async function registerUser(ctx: BotContext) {
  const from = ctx.from!;
  let user = await db.findUser(from.id);

  if (!user) {
    user = await db.createUser(from.id, {
      username: from.username || null,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
    });
    await db.logAction('user_registered', user.id);
    console.log(`✅ New user registered: ${from.id} (${from.username || 'no username'})`);
  } else {
    user = await db.updateUser(from.id, {
      username: from.username || null,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
    });
    console.log(`🔄 User updated: ${from.id}`);
  }

  return user;
}

export async function approveUser(telegramId: number, adminId: string) {
  const user = await db.updateUser(telegramId, {
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: adminId,
    banned_at: null,
    banned_by: null,
    ban_reason: null
  });
  await db.logAction('user_approved', user.id, adminId);
  console.log(`✅ User ${telegramId} approved by ${adminId}`);
  return user;
}

export async function banUser(telegramId: number, adminId: string, reason?: string) {
  const user = await db.updateUser(telegramId, {
    status: 'banned',
    banned_at: new Date().toISOString(),
    banned_by: adminId,
    ban_reason: reason || 'No reason provided'
  });
  await db.logAction('user_banned', user.id, adminId, { reason });
  console.log(`🚫 User ${telegramId} banned by ${adminId}`);
  return user;
}

export async function unbanUser(telegramId: number, adminId: string) {
  const user = await db.updateUser(telegramId, {
    status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: adminId,
    banned_at: null,
    banned_by: null,
    ban_reason: null
  });
  await db.logAction('user_unbanned', user.id, adminId);
  console.log(`♻️ User ${telegramId} unbanned by ${adminId}`);
  return user;
}

export async function sendAnnouncementToGroups(bot: any, message: string, photoUrl?: string) {
  const groups = await db.getGroups();
  let sent = 0, failed = 0;

  for (const group of groups) {
    try {
      if (photoUrl) {
        await bot.telegram.sendPhoto(
          group.chat_id,
          photoUrl,
          { caption: message, parse_mode: 'HTML' }
        );
      } else {
        await bot.telegram.sendMessage(
          group.chat_id,
          message,
          { parse_mode: 'HTML' }
        );
      }
      sent++;
    } catch (error: any) {
      failed++;
      console.error(`❌ Failed to send to group ${group.chat_title}:`, error.message);
      if (error.message?.includes('bot was kicked')) {
        await db.removeGroup(group.chat_id);
      }
    }
  }

  return { sent, failed };
}

export async function sendBroadcast(bot: any, message: string, adminId: string) {
  const users = await db.getApprovedUsers();
  let sent = 0, failed = 0, blocked = 0;

  console.log(`📢 Starting broadcast to ${users.length} users...`);
  await db.logAction('broadcast_started', undefined, adminId, { recipients: users.length });

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'HTML' });
      sent++;
    } catch (error: any) {
      if (error.response?.description?.includes('blocked')) {
        blocked++;
      } else {
        failed++;
        console.error(`❌ Failed to send to ${user.telegram_id}:`, error.message);
      }
    }
    if (sent % 30 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  await db.logAction('broadcast_completed', undefined, adminId, { sent, failed, blocked });
  console.log(`📢 Broadcast complete: ${sent} sent, ${failed} failed, ${blocked} blocked`);
  return { sent, failed, blocked };
}