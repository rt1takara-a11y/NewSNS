"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { periodLabel } from "@/lib/period";
import { PostCard } from "@/components/PostCard";

const ICONS = ["🙂", "🌱", "🌙", "🐟", "☕️", "🎧", "🍋", "🪁", "🦊", "🌸", "⭐️", "🐧"];

export default function ProfilePage() {
  const { state, updateMyProfile } = useStore();
  const [name, setName] = useState(state.me.displayName);
  const [icon, setIcon] = useState(state.me.icon);
  const [bio, setBio] = useState(state.me.bio);
  const [saved, setSaved] = useState(false);

  const myPosts = state.posts
    .filter((p) => p.authorPublicId === state.me.publicId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const onSave = () => {
    updateMyProfile({ displayName: name.trim(), icon, bio: bio.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <>
      <header className="topbar">
        <div className="eyebrow">YOUR MONTHLY SELF</div>
        <h1>今月のあなた</h1>
        <div className="period">{periodLabel(state.period)}のあなた ・ 来月には消えます</div>
      </header>

      <div className="content">
        <div className="card center profile-cover">
          <div className="avatar lg" style={{ margin: "0 auto 8px" }}>{icon}</div>
          <div className="name" style={{ fontSize: 18 }}>{name || "（名前未設定）"}</div>
          <div className="handle">{periodLabel(state.period)}だけのプロフィール</div>
        </div>

        <div className="card">
          <div className="field">
            <label htmlFor="profile-name">今月の名前</label>
            <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：名無しの9月" />
          </div>

          <div className="field">
            <label>今月のアイコン</label>
            <div className="iconpick">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  className={ic === icon ? "sel" : ""}
                  onClick={() => setIcon(ic)}
                  aria-label={ic}
                  aria-pressed={ic === icon}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="profile-bio">ひとこと</label>
            <textarea id="profile-bio" rows={2} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="今月の自分について" />
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            {saved && <span role="status" className="muted" style={{ marginRight: "auto" }}>保存しました</span>}
            <button className="btn" onClick={onSave}>保存</button>
          </div>
        </div>

        <h2 style={{ fontSize: 15, margin: "18px 4px 10px" }}>今月のあなたの投稿</h2>
        {myPosts.length === 0 ? (
          <div className="empty">
            <div className="big">✍️</div>
            <p>まだ投稿がありません。</p>
          </div>
        ) : (
          myPosts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </>
  );
}
