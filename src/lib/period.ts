// 「今週」を表すISO週（日本時間・月曜始まり）を扱う。
// 公開情報は period（例: "2026-W39"）にひも付き、次の月曜に不可視になる。

export function currentPeriod(date: Date = new Date()): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const monday = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((jst.getUTCDay() + 6) % 7));
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstMonday = new Date(Date.UTC(weekYear, 0, 4));
  firstMonday.setUTCDate(firstMonday.getUTCDate() - ((firstMonday.getUTCDay() + 6) % 7));
  const week = Math.floor((monday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

export function periodLabel(period: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(period);
  return match ? `${match[1]}年第${Number(match[2])}週` : period;
}

export function periodParts(period: string): { year: string; week: string } {
  const match = /^(\d{4})-W(\d{2})$/.exec(period);
  return { year: match?.[1] ?? "—", week: match?.[2] ?? "—" };
}
