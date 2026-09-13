"use client";

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { currentConnections, demoConnections, type ConnectionsResult } from '@/lib/connections';
import { publicProfileHref } from '@/lib/publicProfile';

export function ProfileConnections({ publicId }: { publicId: string }) {
  const { state, live, error, refresh } = useStore();
  const [result, setResult] = useState<ConnectionsResult>();
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<'following' | 'followers'>('following');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    let active = true;
    if (!live || error) return;
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase().rpc('reme_connections', {
          target_public_id: publicId, expected_epoch: state.epoch,
        });
        if (rpcError || data?.epoch !== state.epoch || data?.targetPublicId !== publicId ||
            !Array.isArray(data?.following) || !Array.isArray(data?.followers)) throw new Error('Unavailable');
        if (active) setResult({ snapshot: state, data });
      } catch {
        if (active) setResult({ snapshot: state });
      }
    })();
    return () => { active = false; };
  }, [state, live, publicId, attempt, error]);

  // Hide previous responses immediately on identity, month, follow or block changes.
  const data = live ? (!error ? currentConnections(state, publicId, result) : undefined) : demoConnections(state, publicId);
  const failed = live && (!!error || (result?.snapshot === state && !result.data));
  const open = (nextTab: typeof tab) => {
    setTab(nextTab);
    dialog.current?.showModal();
  };
  const status = <p className="muted" role="status">{failed ? 'つながりを取得できませんでした。' : 'つながりを確認しています…'}</p>;
  const retry = failed && <button className="btn ghost small" onClick={() => {
    setResult(undefined); setAttempt(v => v + 1);
    if (error) void refresh().catch(() => {});
  }}>再読み込み</button>;

  return <div className="profile-connections">
    <div className="connection-counts">
      <button className="action" onClick={() => open('following')} aria-haspopup="dialog">
        <strong>{data ? data.following.length : '—'}</strong> フォロー中
      </button>
      <button className="action" onClick={() => open('followers')} aria-haspopup="dialog">
        <strong>{data ? data.followers.length : '—'}</strong> フォロワー
      </button>
    </div>
    {!data && <>{status}{retry}</>}
    <dialog className="connections-dialog" ref={dialog} aria-labelledby={titleId}>
      <div className="row connections-heading">
        <h2 id={titleId}>{tab === 'following' ? '今月のフォロー中' : '今月のフォロワー'}</h2>
        <button className="btn ghost small" autoFocus onClick={() => dialog.current?.close()}>閉じる</button>
      </div>
      {!data ? <>{status}{retry}</> : data[tab].length === 0 ?
        <p className="empty">現在表示できる人はいません。</p> :
        <ul className="connections-list">{data[tab].map(profile => <li key={profile.publicId}>
          <Link className="connection-person" href={publicProfileHref(profile)} onClick={() => dialog.current?.close()}>
            <span className="avatar" aria-hidden="true">{profile.icon}</span>
            <span className="connection-person-text"><span className="name">{profile.displayName || '（名前未設定）'}</span>
              {profile.bio && <span className="muted connection-bio">{profile.bio}</span>}</span>
          </Link>
        </li>)}</ul>}
      <p className="muted">今月、あなたに表示できる人だけを数えています。</p>
    </dialog>
  </div>;
}
