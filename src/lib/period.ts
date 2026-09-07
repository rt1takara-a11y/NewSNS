// 「今月」を表す期間（period）を扱うユーティリティ。
// このSNSでは、公開情報はすべて period（例: "2026-09"）にひも付く。
// 毎月1日に新しい period に切り替わり、前月の period の情報は利用者から見えなくなる。

export function currentPeriod(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${y}年${Number(m)}月`;
}
