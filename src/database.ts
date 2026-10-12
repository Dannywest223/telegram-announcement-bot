import { createClient } from '@supabase/supabase-js';
import { User, UserStatus, Admin, Group } from './types';
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

// WebSocket polyfill for Node.js
if (!global.WebSocket) {
  // @ts-ignore
  global.WebSocket = WebSocket;
}

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===== HELPER: Check if string is a valid UUID =====
function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ===== USER OPERATIONS =====

export async function findUser(telegramId: number): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function findUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function createUser(telegramId: number, data: any): Promise<User> {
  const { data: user, error } = await supabase
    .from('users')
    .insert([{ telegram_id: telegramId, status: 'pending', ...data }])
    .select()
    .single();
  
  if (error) throw error;
  return user;
}

export async function updateUser(telegramId: number, updates: any): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('telegram_id', telegramId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUsersByStatus(status: UserStatus): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function getStats() {
  const { count: total } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: pending } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: approved } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const { count: banned } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'banned');
  
  return {
    total: total || 0,
    pending: pending || 0,
    approved: approved || 0,
    banned: banned || 0,
  };
}

export async function getApprovedUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('status', 'approved');
  
  if (error) throw error;
  return data;
}

// ===== ADMIN OPERATIONS =====

export async function isAdmin(telegramId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('admins')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();
  
  if (error?.code === 'PGRST116') return false;
  if (error) throw error;
  return !!data;
}

export async function isOwner(telegramId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('admins')
    .select('role')
    .eq('telegram_id', telegramId)
    .single();
  
  if (error) return false;
  return data?.role === 'owner';
}

export async function getAdmin(telegramId: number): Promise<Admin | null> {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function addAdmin(userId: string, telegramId: number): Promise<Admin> {
  const { data, error } = await supabase
    .from('admins')
    .insert([{ user_id: userId, telegram_id: telegramId, role: 'admin' }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function removeAdmin(telegramId: number): Promise<void> {
  const { error } = await supabase
    .from('admins')
    .delete()
    .eq('telegram_id', telegramId);
  
  if (error) throw error;
}

export async function getAllAdmins(): Promise<Admin[]> {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
}

// ===== ACTIVITY LOG =====
// FIXED: Now validates UUIDs before inserting

export async function logAction(
  action: string, 
  userId?: string, 
  adminId?: string, 
  metadata?: any
) {
  // Only use user_id and admin_id if they're valid UUIDs
  const validUserId = isValidUUID(userId) ? userId : null;
  const validAdminId = isValidUUID(adminId) ? adminId : null;

  // Store telegram IDs in metadata if they were passed instead of UUIDs
  const enrichedMetadata = {
    ...metadata,
    ...(userId && !isValidUUID(userId) ? { telegram_user_id: userId } : {}),
    ...(adminId && !isValidUUID(adminId) ? { telegram_admin_id: adminId } : {}),
  };

  const { error } = await supabase
    .from('activity_logs')
    .insert([{ 
      action, 
      user_id: validUserId, 
      admin_id: validAdminId, 
      metadata: enrichedMetadata 
    }]);
  
  if (error) console.error('Failed to log action:', error);
}

// ===== GROUP OPERATIONS =====

export async function addGroup(chatId: string, chatTitle: string, chatUsername: string | null, addedBy: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert([{
      chat_id: chatId,
      chat_title: chatTitle,
      chat_username: chatUsername,
      status: 'active',
      added_by: addedBy
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function getGroupByChatId(chatId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('chat_id', chatId)
    .single();
  
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function removeGroup(chatId: string): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ status: 'inactive' })
    .eq('chat_id', chatId);
  
  if (error) throw error;
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert([{ group_id: groupId, user_id: userId }]);
  
  if (error) console.error('Error adding group member:', error);
}

export async function getGroupMembers(groupId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('users(*)')
    .eq('group_id', groupId);
  
  if (error) throw error;
  return data.map((d: any) => d.users);
}

export async function getAllGroupMembers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('users(*)');
  
  if (error) throw error;
  return data.map((d: any) => d.users);
}

// ===== INITIALIZE OWNER =====

export async function initializeOwner() {
  const ownerId = parseInt(process.env.OWNER_TELEGRAM_ID!);
  const user = await findUser(ownerId);
  if (!user) return;

  const admin = await getAdmin(ownerId);
  if (!admin) {
    await supabase
      .from('admins')
      .insert([{ user_id: user.id, telegram_id: ownerId, role: 'owner' }]);
    console.log(`✅ Owner ${ownerId} initialized as admin`);
  }
}

// ===== REPEATING MESSAGES =====

export async function createRepeatingMessage(
  message: string,
  photoUrl: string | null,
  createdBy: string,
  intervalMinutes: number = 10
) {
  // Deactivate all existing repeating messages
  await supabase
    .from('repeating_messages')
    .update({ is_active: false })
    .eq('is_active', true);

  // Create new repeating message
  const { data, error } = await supabase
    .from('repeating_messages')
    .insert([{
      message,
      photo_url: photoUrl,
      interval_minutes: intervalMinutes,
      is_active: true,
      created_by: createdBy
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getActiveRepeatingMessage() {
  const { data, error } = await supabase
    .from('repeating_messages')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function stopRepeatingMessage() {
  const { error } = await supabase
    .from('repeating_messages')
    .update({ is_active: false })
    .eq('is_active', true);
  
  if (error) throw error;
}