"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "タイムライン", icon: "home" },
  { href: "/discover", label: "さがす", icon: "compass" },
  { href: "/profile", label: "プロフィール", icon: "user" },
  { href: "/restart", label: "再スタート", icon: "reset" },
];
export function TabBar() {
  const pathname = usePathname();
  return <nav className="tabbar" aria-label="メインナビゲーション">
    <Link href="/" className="brand" aria-label="RE:ME ホーム"><span className="brand-symbol"><Icon name="reset" /></span><span>RE:ME<span className="brand-caption">A NEW MONTH. A NEW YOU.</span></span></Link>
    <div className="nav-links">{items.map(it => <Link key={it.href} href={it.href} className={pathname === it.href ? "active" : ""} aria-current={pathname === it.href ? "page" : undefined}><Icon name={it.icon} /><span>{it.label}</span></Link>)}</div>
    <div className="nav-foot"><span className="eyebrow">MAKE ROOM FOR NOW</span><p>今月の自分で、<br />つながろう。</p><span className="handle">試作品 · データは保存されません</span></div>
  </nav>;
}
