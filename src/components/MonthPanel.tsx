"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { periodLabel } from "@/lib/period";
import { Icon } from "./Icon";

export function MonthPanel() {
  const { state, live } = useStore();
  const [year, month] = state.period.split("-");
  return <aside className="month-panel" aria-label="今月について">
    <div className="month-card"><div className="eyebrow">THIS CHAPTER</div><div className="month-number">{month}<span>/ {year}</span></div><div className="month-title">{periodLabel(state.period)}の世界</div><div className="month-rule" /><p>名前も、言葉も、つながりも。<br />月が変われば、まっさらになる。</p><Link href="/restart" className="month-link">再スタートについて<Icon name="arrow" /></Link></div>
    <div className="side-note"><Icon name="reset" /><h2>残さない、という自由。</h2><p>前月のプロフィールや投稿は引き継がれません。今月の出会いを楽しもう。</p></div>
    <Link href="/profile" className="side-profile"><div className="avatar">{state.me.icon}</div><div><div className="name">{state.me.displayName || "今月の名前を決める"}</div><span className="handle">今月のあなた</span></div><Icon name="arrow" /></Link>
    <p className="prototype-note">{live ? "日本時間の毎月1日にリセットされます。" : <>体験版のため、再読み込みすると<br />初期状態に戻ります。</>}</p>
  </aside>;
}
