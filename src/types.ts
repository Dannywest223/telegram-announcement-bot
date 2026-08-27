export type UserStatus = 'pending' | 'approved' | 'banned';
export type GroupStatus = 'active' | 'inactive';

export interface User {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  approved_at?: Date;
  approved_by?: string;
  banned_at?: Date;
  banned_by?: string;
  ban_reason?: string;
}

export interface Group {
  id: string;
  chat_id: string;
  chat_title: string;
  chat_username: string | null;
  status: GroupStatus;
  added_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Admin {
  id: string;
  user_id: string;
  telegram_id: number;
  role: 'owner' | 'admin';
  created_at: Date;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  admin_id: string | null;
  action: string;
  metadata: any;
  created_at: Date;
}