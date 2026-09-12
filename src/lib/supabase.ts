import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | null = null;
export function backendConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
export function supabase(): SupabaseClient {
  if (!backendConfigured()) throw new Error('BACKEND_NOT_CONFIGURED');
  if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as {message?: string})?.message || error);
  const known: Record<string,string> = {
    ACCOUNT_SUSPENDED: 'このアカウントは利用停止中です。運営へお問い合わせください。',
    PERIOD_CHANGED: '新しい月になりました。今月の名前を設定して、もう一度お試しください。',
    AUTH_REQUIRED: 'ログインし直してください。',
    PROFILE_REQUIRED: 'プロフィールで今月の名前を設定してください。',
    RATE_LIMITED: '操作が続いています。1分ほど待ってからお試しください。',
    NOT_FOUND: 'この投稿や相手は現在表示できません。更新してお試しください。',
    INVALID_INPUT: '入力内容と文字数を確認してください。',
    FORBIDDEN: 'この操作はできません。',
    BACKEND_NOT_CONFIGURED: 'ただいま参加受付の準備中です。',
  };
  for (const [key,text] of Object.entries(known)) if (message.includes(key)) return text;
  if (/rate|too many|security purposes/i.test(message)) return 'しばらく待ってから、もう一度お試しください。';
  if (/expired|invalid.*(otp|token)/i.test(message)) return '確認コードが正しくないか期限切れです。新しいコードを取得してください。';
  return '通信できませんでした。入力内容はそのままで、もう一度お試しください。';
}
