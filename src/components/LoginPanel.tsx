"use client";
import { useState } from 'react';
import { friendlyError,supabase } from '@/lib/supabase';
import { PasswordLoginForm } from './PasswordLoginForm';

function EmailLoginForm(){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [resendAt,setResendAt]=useState(0);
 async function send(){
  if(busy)return;setBusy(true);setError('');
  try{if(Date.now()<resendAt){setError('コードの再送は60秒ほど待ってください。');return;}
   const {error}=await supabase().auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:true}});if(error)throw error;
   setSent(true);setResendAt(Date.now()+60000);
  }catch(e){setError(friendlyError(e));}finally{setBusy(false);}
 }
 async function verify(){
  if(busy)return;setBusy(true);setError('');
  try{const {error}=await supabase().auth.verifyOtp({email:email.trim(),token:code.trim(),type:'email'});if(error)throw error;}
  catch(e){setError(friendlyError(e));}finally{setBusy(false);}
 }
 return <form onSubmit={e=>{e.preventDefault();void(sent?verify():send());}}><h2>メールでログイン</h2>
 <label htmlFor="email">メールアドレス</label><input id="email" type="email" autoComplete="email" required value={email} disabled={sent||busy} onChange={e=>setEmail(e.target.value)}/>
 {sent&&<><label htmlFor="otp">メールに届いた確認コード</label><input id="otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={code} onChange={e=>setCode(e.target.value)}/><p role="status">届いたコードを入力してください。</p></>}
 {error&&<p role="alert">{error}</p>}
 <button className="btn" disabled={busy}>{busy?'確認中…':sent?'ログイン':'確認コードを送る'}</button>
 {sent&&<><button className="btn ghost" type="button" disabled={busy} onClick={()=>void send()}>コードを再送</button><button className="action" type="button" onClick={()=>{setSent(false);setCode('');}}>メールアドレスを変更</button></>}
 </form>;
}

export function LoginPanel() {
 const enabled = process.env.NEXT_PUBLIC_LOGIN_ID_ENABLED === 'true';
 const [method, setMethod] = useState<'login' | 'register' | 'email'>(enabled ? 'login' : 'email');
 return <section className="auth-shell"><div className="eyebrow">A NEW MONTH. A NEW YOU.</div><h1>RE:ME</h1>
  <p>毎月、あたらしい自分に。</p>
  {enabled && <div className="auth-methods" role="group" aria-label="ログイン方法">
   <button className="btn ghost small" aria-pressed={method === 'login'} onClick={() => setMethod('login')}>IDでログイン</button>
   <button className="btn ghost small" aria-pressed={method === 'register'} onClick={() => setMethod('register')}>新規登録</button>
   <button className="btn ghost small" aria-pressed={method === 'email'} onClick={() => setMethod('email')}>メールを使う</button>
  </div>}
  {method === 'email' ? <EmailLoginForm /> : <PasswordLoginForm key={method} registering={method === 'register'} />}
  <details><summary>参加前にお読みください</summary><p className="muted">誹謗中傷、個人情報の無断公開、なりすまし、嫌がらせは禁止です。ログインID・メールアドレスは認証に使用し、他の利用者には公開しません。投稿・通報記録は運営の対応のために保持します。公開情報のリセットと運営記録の削除は別の処理です。</p></details>
  <p className="handle">名前・投稿・つながりは毎月リセットされます。ログイン情報は継続します。</p>
 </section>;
}
