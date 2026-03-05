/**
 * SupabaseService - 云端认证与同步（v2.0 接入）
 * v1.0 阶段此模块暂不启用，接口保持稳定
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// 未配置 Supabase 时跳过初始化
const isConfigured = !!supabaseUrl && !!supabaseAnonKey;

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// ===== 认证接口 =====
export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error('Supabase 未配置');
  return await supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase 未配置');
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return;
  return await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
