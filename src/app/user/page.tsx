"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { findPublicProfile, publicProfilePosts } from "@/lib/publicProfile";
import { periodLabel } from "@/lib/period";
import { PostCard } from "@/components/PostCard";
import { ProfileConnections } from "@/components/ProfileConnections";

function LoadingProfile() {
  return <div className="content" role="status">今月のプロフィールを確認しています…</div>;
}

function PublicProfile() {
  const publicId = useSearchParams().get("id");
  const { state, live, refresh, busy, error, toggleFollow } = useStore();
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setCheckedId(null);
    setFailed(false);
    if (live && publicId) {
      void refresh().then(() => {
        if (active) setCheckedId(publicId);
      }).catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; };
  }, [publicId, live, refresh, attempt]);

  const loading = live && publicId && checkedId !== publicId;
  const profile = findPublicProfile(state, publicId);
  const ownProfile = profile?.publicId === state.me.publicId;
  const following = !!profile && state.following.includes(profile.publicId);
  const posts = publicProfilePosts(state, publicId);

  return <>
    <header className="topbar">
      <div className="eyebrow">THIS MONTH'S PROFILE</div>
      <h1>今月のプロフィール</h1>
      <div className="period">{periodLabel(state.period)}だけのつながり</div>
    </header>
    <div className="content">
      <Link className="action" href="/discover/">今月の出会いへ</Link>
      {failed || (live && error) ? <div className="empty">
        <p role="alert">プロフィールを確認できませんでした。</p>
        <button className="btn" disabled={busy} onClick={() => setAttempt((v) => v + 1)}>再読み込み</button>
      </div> : loading ? <LoadingProfile /> : !profile ? <div className="empty">
        <p>このプロフィールは現在表示できません。</p>
        <p>今月の出会いから、参加している人を見つけてください。</p>
      </div> : <>
        <section className="card center profile-cover" aria-labelledby="public-profile-name">
          <div className="avatar lg profile-avatar" aria-hidden="true">{profile.icon}</div>
          <h2 id="public-profile-name" className="profile-name">{profile.displayName || "（名前未設定）"}</h2>
          <p className="post-body">{profile.bio || "自己紹介はまだありません。"}</p>
          <ProfileConnections key={profile.publicId} publicId={profile.publicId} />
          {ownProfile ? <Link className="btn ghost" href="/profile/">プロフィールを編集</Link> :
            <button className={following ? "btn ghost" : "btn"} disabled={busy}
              aria-pressed={following} onClick={() => void toggleFollow(profile.publicId)}>
              {following ? "フォロー解除" : "フォロー"}
            </button>}
        </section>
        <h2 className="profile-posts-heading">今月の投稿</h2>
        {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) :
          <div className="empty"><p>現在表示できる投稿はありません。</p></div>}
        {live && <p className="muted profile-posts-note">全体の最新100件から、この人の投稿を表示しています。</p>}
      </>}
    </div>
  </>;
}

// A static route with a query parameter supports new monthly IDs without
// generating profile pages at build time or changing the existing Sites host.
export default function UserPage() {
  return <Suspense fallback={<LoadingProfile />}><PublicProfile /></Suspense>;
}
