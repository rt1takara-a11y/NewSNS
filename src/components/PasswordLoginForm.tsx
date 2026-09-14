"use client";

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'IDまたはパスワードが正しくないか、このアカウントではログインできません。',
  INVALID_INPUT: 'IDとパスワードの文字数・使える文字を確認してください。',
  RECOVERY_ACK_REQUIRED: '復旧できないことを確認してチェックしてください。',
  REGISTRATION_UNAVAILABLE: 'このIDでは登録できません。登録済みならログインするか、別のIDを選んでください。',
  RATE_LIMITED: '操作が続いています。時間をおいてから、もう一度お試しください。',
};

export function PasswordLoginForm({ registering }: { registering: boolean }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);

  async function submit() {
    if (locked.current) return;
    setError('');
    if (registering && password !== confirmation) { setError('確認用のパスワードが一致しません。'); return; }
    locked.current = true; setBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reme-password-auth`, {
        method: 'POST', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json', apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        body: JSON.stringify({ action: registering ? 'register' : 'login', loginId, password, noRecoveryAccepted: accepted }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(MESSAGES[result?.error] ?? '接続できませんでした。登録直後の場合は、同じIDでログインをお試しください。');
        return;
      }
      if (typeof result.access_token !== 'string' || typeof result.refresh_token !== 'string') throw new Error('UNAVAILABLE');
      const { error: sessionError } = await supabase().auth.setSession({
        access_token: result.access_token, refresh_token: result.refresh_token,
      });
      if (sessionError) throw new Error('SESSION_FAILED');
      setPassword(''); setConfirmation('');
    } catch {
      setError('接続できませんでした。登録直後の場合は、同じIDでログインをお試しください。');
    } finally { locked.current = false; setBusy(false); }
  }

  return <form onSubmit={e => { e.preventDefault(); void submit(); }}>
    <h2>{registering ? 'メール不要で新規登録' : 'IDでログイン'}</h2>
    <label htmlFor="login-id">ログインID</label>
    <input id="login-id" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
      required minLength={4} maxLength={24} pattern="[A-Za-z][A-Za-z0-9_\-]{3,23}" disabled={busy}
      value={loginId} onChange={e => setLoginId(e.target.value)} aria-describedby="login-id-hint" />
    <p id="login-id-hint" className="muted">半角英字で始まる4〜24文字。英数字・ハイフン・アンダースコアが使えます。大文字・小文字は区別しません。他の利用者には公開されません。</p>
    <label htmlFor="login-password">パスワード</label>
    <input id="login-password" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
      required minLength={15} maxLength={72} disabled={busy} value={password} onChange={e => setPassword(e.target.value)}
      aria-describedby="password-hint" />
    <p id="password-hint" className="muted">半角英数字・記号・スペースで15〜72文字。ほかのサービスとは別のパスワードにしてください。</p>
    {registering && <>
      <label htmlFor="confirm-password">パスワード（確認）</label>
      <input id="confirm-password" type="password" autoComplete="new-password" required minLength={15} maxLength={72}
        disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      <p className="notice">IDやパスワードを忘れてログインできなくなると、アカウントを復旧できません。復旧コードやメールによる再設定はありません。パスワード管理機能などに保存してください。</p>
      <label className="auth-consent"><input type="checkbox" required disabled={busy} checked={accepted} onChange={e => setAccepted(e.target.checked)} />
        ID・パスワードを紛失した場合、復旧できないことを確認しました。</label>
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="btn" disabled={busy}>{busy ? '確認中…' : registering ? '同意して登録' : 'ログイン'}</button>
    {!registering && <p className="muted">ID・パスワードを紛失した場合の復旧はできません。</p>}
  </form>;
}
