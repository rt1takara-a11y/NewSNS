"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { periodLabel } from "@/lib/period";

export default function RestartPage() {
  const { state, monthlyReset, live } = useStore();
  const [done, setDone] = useState(false);

  const onReset = () => {
    monthlyReset();
    setDone(true);
  };

  const empty =
    state.posts.length === 0 && state.following.length === 0 && !state.me.displayName.trim();

  return (
    <>
      <header className="topbar">
        <div className="eyebrow">A FRESH START</div>
        <h1>また、まっさらから。</h1>
        <div className="period">{periodLabel(state.period)} ・ 月初のあなた</div>
      </header>

      <div className="content">
        {live && !empty ? <div className="card"><h2>次の月は、まっさらから。</h2><p>日本時間の毎月1日 0:00に、名前・投稿・フォロー・いいね・返信がリセットされます。</p><p className="muted">ログイン用アカウントは継続します。来月の自分に会うのを、楽しみに。</p><Link className="btn" href="/">今月のタイムラインへ</Link></div> : !done && !empty ? (
          <>
            <div className="notice">
              月が変わると、名前・投稿・フォロー・いいね・返信・公開IDが<strong>すべて消えます</strong>。
              残るのはログイン用のアカウントだけ。ここでは、その「月初のリセット」を試せます。
            </div>
            <div className="card">
              <p className="post-body">
                いま試作品では、ボタンひとつで月初の状態を再現します。
                本番では毎月1日に自動で実行されます。
              </p>
              <button className="btn" onClick={onReset}>今すぐリセットして月初を体験する</button>
            </div>
          </>
        ) : (
          <>
            <div className="card center">
              <div className="big" style={{ fontSize: 44 }}>🌅</div>
              <h2 style={{ margin: "6px 0" }}>新しい月がはじまりました</h2>
              <p className="muted">
                前の月のあなたは、もう誰からも見えません。<br />
                名前も、つながりも、まっさらです。
              </p>
              <div className="handle" style={{ marginTop: 8 }}>
                今月の新しいプロフィールが用意されました。
              </div>
            </div>

            <h2 style={{ fontSize: 15, margin: "18px 4px 10px" }}>はじめの一歩</h2>

            <div className="card">
              <div className="post-head">
                <div className="avatar">🙂</div>
                <div><div className="name">今月の名前を決める</div><div className="handle">まずは自己紹介から</div></div>
                <Link className="btn small" href="/profile" style={{ marginLeft: "auto" }}>設定</Link>
              </div>
            </div>

            <div className="card">
              <div className="post-head">
                <div className="avatar">🔍</div>
                <div><div className="name">今月の人をさがす</div><div className="handle">また、出会い直そう</div></div>
                <Link className="btn small" href="/discover" style={{ marginLeft: "auto" }}>さがす</Link>
              </div>
            </div>

            <div className="card">
              <div className="post-head">
                <div className="avatar">✍️</div>
                <div><div className="name">最初の一言を書く</div><div className="handle">消えるから、自由に</div></div>
                <Link className="btn small" href="/" style={{ marginLeft: "auto" }}>投稿へ</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

