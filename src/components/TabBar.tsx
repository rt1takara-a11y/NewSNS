"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "タイムライン", icon: "🏠" },
  { href: "/discover", label: "さがす", icon: "🔍" },
  { href: "/profile", label: "プロフィール", icon: "🙂" },
  { href: "/restart", label: "再スタート", icon: "🌀" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link key={it.href} href={it.href} className={active ? "active" : ""}>
            <span className="ic">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
