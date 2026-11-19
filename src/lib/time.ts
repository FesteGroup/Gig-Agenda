// All dates/times in Asia/Hong_Kong. Days are stored as YYYY-MM-DD strings, times as HH:MM(:SS).
export const TZ = "Asia/Hong_Kong";

export function hkToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function toDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function parseDay(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

export function hhmm(t?: string | null): string {
  return t ? t.slice(0, 5) : "";
}

export function minutesOf(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Paid hours for a shift, handling shifts past midnight. */
export function shiftHours(start: string, end: string, breakMinutes = 0): number {
  let mins = minutesOf(end) - minutesOf(start);
  if (mins <= 0) mins += 24 * 60;
  return Math.max(0, (mins - breakMinutes) / 60);
}

/** Do two time ranges overlap (same day, end may pass midnight)? */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const norm = (s: string, e: string) => {
    const a = minutesOf(s);
    let b = minutesOf(e);
    if (b <= a) b += 1440;
    return [a, b] as const;
  };
  const [a1, a2] = norm(aStart, aEnd);
  const [b1, b2] = norm(bStart, bEnd);
  return a1 < b2 && b1 < a2;
}

export function fmtDay(s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return parseDay(s).toLocaleDateString("en-GB", opts);
}

export function hkd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "HK$" + Math.round(n).toLocaleString("en-HK");
}

/** HK$ with cents, never rounded (for expenses). */
export function hkdExact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "HK$" + n.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
