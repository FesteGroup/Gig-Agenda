import { minutesOf, overlaps, parseDay } from "./time";

export type DayAvail = { status: "available" | "partial" | "unavailable"; start_time: string | null; end_time: string | null };

/** Resolve a staff member's availability for a day: specific day entry wins over weekly pattern. */
export function resolveAvail(day: string, dayEntry?: DayAvail | null, patterns: (DayAvail & { weekday: number })[] = []): DayAvail | null {
  if (dayEntry) return dayEntry;
  const wd = parseDay(day).getDay();
  return patterns.find((p) => p.weekday === wd) ?? null;
}

export function coversShift(a: DayAvail | null, start: string, end: string): boolean {
  if (!a || a.status === "unavailable") return false;
  if (a.status === "available" || !a.start_time || !a.end_time) return true;
  const span = (x: string, y: string) => {
    const s = minutesOf(x);
    let e = minutesOf(y);
    if (e <= s) e += 1440;
    return [s, e] as const;
  };
  const [ws, we] = span(a.start_time, a.end_time);
  const [ss, se] = span(start, end);
  return ws <= ss && se <= we;
}

export { overlaps };
