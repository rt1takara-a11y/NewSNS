"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { AppState, Profile } from './types';
import { initialState, resetState, newPublicId } from './mockData';
import { backendConfigured, friendlyError, supabase } from './supabase';
import { LoginPanel } from '@/components/LoginPanel';

type Store = {
 state: AppState; live: boolean; busy: boolean; error: string; refresh: () => Promise<void>;
 createPost: (body:string, id?:string)=>Promise<boolean>;
 toggleLike: (id:string)=>Promise<boolean>; addReply: (id:string, body:string, operationId?:string)=>Promise<boolean>;
 toggleFollow:(id:string)=>Promise<boolean>; updateMyProfile:(patch:Partial<Profile>)=>Promise<boolean>;
 monthlyReset:()=>void; discoverPeople:()=>Promise<void>;
 blockPerson:(id:string,enabled:boolean)=>Promise<boolean>; reportPost:(id:string,reason:string)=>Promise<boolean>;
 deletePost:(id:string)=>Promise<boolean>;
};
const Context=createContext<Store|null>(null);
const emptyState=():AppState=>({...resetState(),epoch:'',blocked:[]});

export function StoreProvider({children}:{children:React.ReactNode}) {
 const live=backendConfigured();
 const [state,setState]=useState<AppState>(()=>live?emptyState():initialState());
 const [status,setStatus]=useState<'loading'|'signedOut'|'ready'|'error'>(live?'loading':'ready');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const locked=useRef(false), requestVersion=useRef(0), identity=useRef<string|null>(null);
 const refresh=useCallback(async()=>{
  if(!live)return;
  const request=++requestVersion.current;
  const {data,error:failure}=await supabase().rpc('reme_state');
  if(request!==requestVersion.current)return;
  if(failure){setError(friendlyError(failure)); if(/ACCOUNT_SUSPENDED|AUTH_REQUIRED|JWT|token/i.test(failure.message)){setState(emptyState());setStatus('error');} throw failure;}
  setState(data as AppState);setStatus('ready');setError('');
 },[live]);
 useEffect(()=>{
  if(!live)return;
  let alive=true;
  const accept=(id:string|null)=>{
   if(!alive)return;
   if(identity.current!==id){identity.current=id;requestVersion.current++;setState(emptyState());setError('');}
   if(!id){setStatus('signedOut');return;}
   setStatus('loading');
   void refresh().catch(()=>{if(alive)setStatus('error');});
  };
  void supabase().auth.getSession().then(({data,error})=>{if(!alive)return;if(error){setError(friendlyError(error));setStatus('signedOut');}else accept(data.session?.user.id??null);});
  const {data:{subscription}}=supabase().auth.onAuthStateChange((event,session)=>{
   if(event==='INITIAL_SESSION')return;
   // Defer RPC outside the synchronous auth callback to avoid auth-client locks.
   if(event==='TOKEN_REFRESHED')return;
   setTimeout(()=>accept(session?.user.id??null),0);
  });
  return()=>{alive=false;subscription.unsubscribe();requestVersion.current++;};
 },[live,refresh]);
 useEffect(()=>{
  if(!live||status!=='ready')return;
  const update=()=>{if(document.visibilityState==='visible'&&!locked.current)void refresh().catch(()=>{});};
  const timer=setInterval(update,15000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
  return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
 },[live,status,refresh]);
 useEffect(()=>{
  if(!live||status!=='ready'||!state.nextResetAt||!state.serverNow)return;
  const remaining=state.nextResetAt-state.serverNow;
  // API polling refreshes this timer; cap browser setTimeout to its signed 32-bit limit.
  if(remaining>2147480000)return;
  const timer=setTimeout(()=>{requestVersion.current++;setState(emptyState());setStatus('loading');void refresh().catch(()=>setStatus('error'));},Math.max(0,remaining));
  return()=>clearTimeout(timer);
 },[live,status,state.nextResetAt,state.serverNow,refresh]);
 const mutate=useCallback(async(action:string,payload:Record<string,unknown>,mock:(s:AppState)=>AppState)=>{
  if(locked.current)return false;
  locked.current=true;setBusy(true);setError('');
  const request=++requestVersion.current;
  try{
   if(live){
    const {data,error:failure}=await supabase().rpc('reme_mutate',{action,payload,expected_epoch:state.epoch});
    if(failure)throw failure;
    if(request!==requestVersion.current)return false;
    setState(data as AppState);
   }else setState(mock);
   return true;
  }catch(e){
   if(request===requestVersion.current){setError(friendlyError(e));if(String((e as {message?:string})?.message).includes('PERIOD_CHANGED')){setState(emptyState());await refresh().catch(()=>{});setError(friendlyError(e));}}
   return false;
  }finally{locked.current=false;setBusy(false);}
 },[live,state.epoch,refresh]);
 const store:Store=useMemo(()=>({
  state,live,busy,error,refresh,
  createPost:(body,id)=>mutate('post',{body,id:id??crypto.randomUUID()},s=>({...s,posts:[{id:newPublicId(),authorPublicId:s.me.publicId,body:body.trim(),createdAt:Date.now(),likedBy:[],replies:[]},...s.posts]})),
  toggleLike:id=>mutate('like',{postId:id,enabled:!state.posts.find(p=>p.id===id)?.likedBy.includes(state.me.publicId)},s=>({...s,posts:s.posts.map(p=>p.id!==id?p:{...p,likedBy:p.likedBy.includes(s.me.publicId)?p.likedBy.filter(x=>x!==s.me.publicId):[...p.likedBy,s.me.publicId]})})),
  addReply:(id,body,operationId)=>mutate('reply',{postId:id,body,id:operationId??crypto.randomUUID()},s=>({...s,posts:s.posts.map(p=>p.id!==id?p:{...p,replies:[...p.replies,{id:newPublicId(),authorPublicId:s.me.publicId,body:body.trim(),createdAt:Date.now()}]})})),
  toggleFollow:id=>mutate('follow',{target:id,enabled:!state.following.includes(id)},s=>({...s,following:s.following.includes(id)?s.following.filter(x=>x!==id):[...s.following,id]})),
  updateMyProfile:patch=>mutate('profile',patch,s=>({...s,me:{...s.me,...patch}})),
  monthlyReset:()=>{if(!live)setState(resetState());},
  discoverPeople:async()=>{if(live)await refresh().catch(()=>{});else setState(s=>({...initialState(),me:s.me,following:s.following}));},
  blockPerson:(id,enabled)=>mutate(enabled?'block':'unblock',{target:id},s=>({...s,blocked:enabled?[...(s.blocked??[]),...s.people.filter(p=>p.publicId===id)]:(s.blocked??[]).filter(p=>p.publicId!==id),posts:enabled?s.posts.filter(p=>p.authorPublicId!==id):s.posts,people:enabled?s.people.filter(p=>p.publicId!==id):[...s.people,...(s.blocked??[]).filter(p=>p.publicId===id)],following:s.following.filter(x=>x!==id)})),
  reportPost:(id,reason)=>mutate('report',{postId:id,reason},s=>s),
  deletePost:id=>mutate('delete_post',{postId:id},s=>({...s,posts:s.posts.filter(p=>p.id!==id)})),
 }),[state,live,busy,error,refresh,mutate]);
 // Auth screen intentionally excludes navigation, names and content until a DB-authorized snapshot arrives.
 if(status==='signedOut')return <LoginPanel/>;
 if(status==='loading')return <div className="auth-shell"><h1>RE:ME</h1><p role="status">今月の世界を開いています…</p></div>;
 if(status==='error')return <div className="auth-shell"><h1>RE:ME</h1><p role="alert">{error}</p><button className="btn" onClick={()=>void refresh().catch(()=>{})}>再読み込み</button><button className="btn ghost" onClick={()=>void supabase().auth.signOut()}>ログアウト</button></div>;
 return <Context.Provider value={store}>
  {!live&&<div className="demo-banner">体験版 · 入力は保存されません。参加受付は準備中です。</div>}
  {error&&<div role="alert" className="save-error">{error}</div>}
  <React.Fragment key={state.me.publicId}>{children}</React.Fragment>
  <footer className="service-footer"><Link href="/about">利用案内・お問い合わせ</Link>{live&&<button className="action" onClick={()=>void supabase().auth.signOut()}>ログアウト</button>}</footer>
 </Context.Provider>;
}
export function useStore(){const value=useContext(Context);if(!value)throw new Error('StoreProvider required');return value;}
export function useProfileLookup(){const {state}=useStore();return(id:string)=>id===state.me.publicId?state.me:state.people.find(p=>p.publicId===id);}
