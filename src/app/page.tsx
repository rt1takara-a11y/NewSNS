"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { periodLabel } from "@/lib/period";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";

export default function TimelinePage() {
  const { state } = useStore();
  const [tab, setTab] = useState<"latest" | "following">("latest");

  const posts = [...state.posts].sort((a, b) => b.createdAt - a.createdAt);
  const visible =
    tab === "latest"
      ? posts
      : posts.filter(
          (p) => state.following.includes(p.authorPublicId) || p.authorPublicId === state.me.publicId
        );

  return (
    <>
      <header className="topbar">
        <h1>タイムライン</h1>
        <div className="period">{periodLabel(state.period)}の世界 ・ 月末にすべて消えます</div>
      </header>

      <div className="content">
        <div className="tabs">
          <button className={tab === "latest" ? "tab active" : "tab"} onClick={() => setTab("latest")}>
            新着
          </button>
          <button
            className={tab === "following" ? "tab active" : "tab"}
            onClick={() => setTab("following")}
          >
            フォロー中
          </button>
        </div>

        <PostComposer />

        {visible.length === 0 ? (
          tab === "following" ? (
            <div className="empty">
              <div className="big">🫧</div>
              <p>まだ誰もフォローしていません。</p>
              <p>
                <Link className="btn ghost small" href="/discover">
                  今月の人をさがす
                </Link>
              </p>
            </div>
          ) : (
            <div className="empty">
              <div className="big">🌙</div>
              <p>まだ投稿がありません。今月の最初の一言を。</p>
            </div>
          )
        ) : (
          visible.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </>
  );
}
