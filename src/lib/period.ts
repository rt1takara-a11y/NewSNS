// 「今月」を表す期間（period）を扱うユーティリティ。
// このSNSでは、公開情報はすべて period（例: "2026-09"）にひも付く。
// 毎月1日に新しい period に切り替わり、前月の period の情報は利用者から見えなくなる。

export function currentPeriod(date: Date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${y}年${Number(m)}月`;
}

