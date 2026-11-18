import { minutesOf } from "./time";

/**
 * Relish staff pay rules (from the Relish servers' payment file):
 * - Servers: HK$650 for the first 4 hours, then HK$150 per extra hour.
 *   Senior servers (personal rate HK$180, e.g. Jacqueline, Yulie, Eddie): HK$750 for the first 4 hours, then HK$180.
 *   After midnight: HK$200 per hour.
 * - Bartenders: HK$200 per hour, HK$300 per hour after midnight.
 * - Mixologists: HK$300 per hour, HK$350 per hour after midnight.
 * - Public holidays (Hong Kong general holidays, Sundays excluded, or event notes containing "PUBLIC HOLIDAY"): double pay.
 * - Gingers positions ("Gingers · …"): flat hourly cost (no 4-hour block), doubled on public holidays.
 * Other positions use the hourly cost (personal rate first, else the position rate).
 */
export const SERVER_BLOCK_HOURS = 4;
const SERVER_BLOCK: Record<number, number> = { 150: 650, 180: 750 };
const NIGHT_RATE: Record<string, number> = { server: 200, bartender: 300, mixologist: 350 };
const DAY_RATE: Record<string, number> = { bartender: 200, mixologist: 300 };

export function splitHours(start: string, end: string, breakMinutes = 0) {
  const s = minutesOf(start);
  let e = minutesOf(end);
  if (e <= s) e += 1440;
  const night = Math.max(0, Math.min(e, 1440 + 8 * 60) - Math.max(s, 1440)) / 60; // 00:00–08:00 next day
  const total = (e - s) / 60;
  const normal = Math.max(0, total - night - breakMinutes / 60);
  return { normal, night, total: normal + night };
}

export function kindOf(position: string | null | undefined): "server" | "bartender" | "mixologist" | null {
  const p = (position ?? "").toLowerCase();
  if (p.includes("mixolog")) return "mixologist";
  if (p.includes("bartender") || p.includes("bar tender")) return "bartender";
  if (p.includes("server") || p.includes("waiter")) return "server";
  return null;
}

/** Pay for one person on one shift, or null when no rate is known. */
export function shiftPay(opts: {
  position: string | null | undefined;
  start: string;
  end: string;
  breakMinutes?: number | undefined;
  personalRate?: number | null | undefined;
  positionRate?: number | null | undefined;
  publicHoliday?: boolean | undefined;
}): number | null {
  const { normal, night, total } = splitHours(opts.start, opts.end, opts.breakMinutes ?? 0);
  const kind = kindOf(opts.position);
  let pay: number | null;
  if (/^gingers\b/i.test((opts.position ?? "").trim())) {
    const rate = opts.personalRate ?? opts.positionRate;
    pay = rate == null ? null : Number(rate) * total;
  } else if (kind === "server") {
    const extra = Number(opts.personalRate ?? opts.positionRate ?? 150);
    const block = SERVER_BLOCK[extra] ?? extra * SERVER_BLOCK_HOURS;
    pay = block + Math.max(0, normal - SERVER_BLOCK_HOURS) * extra + night * NIGHT_RATE["server"]!;
  } else if (kind) {
    const rate = Number(opts.personalRate ?? opts.positionRate ?? DAY_RATE[kind]);
    pay = normal * rate + night * Math.max(NIGHT_RATE[kind]!, rate);
  } else {
    const rate = opts.personalRate ?? opts.positionRate;
    pay = rate == null ? null : Number(rate) * total;
  }
  return pay == null ? null : opts.publicHoliday ? pay * 2 : pay;
}

/** Hong Kong general holidays other than Sundays (GovHK lists for 2026 and 2027). */
export const HK_PUBLIC_HOLIDAYS = new Set([
  "2026-01-01", "2026-02-17", "2026-02-18", "2026-02-19", "2026-04-03", "2026-04-04", "2026-04-06", "2026-04-07",
  "2026-05-01", "2026-05-25", "2026-06-19", "2026-07-01", "2026-09-26", "2026-10-01", "2026-10-19", "2026-12-25", "2026-12-26",
  "2027-01-01", "2027-02-06", "2027-02-08", "2027-02-09", "2027-03-26", "2027-03-27", "2027-03-29", "2027-04-05",
  "2027-05-01", "2027-05-13", "2027-06-09", "2027-07-01", "2027-09-16", "2027-10-01", "2027-10-08", "2027-12-25", "2027-12-27",
]);

/** Public holiday: a Hong Kong general holiday (not Sundays), or event notes saying "PUBLIC HOLIDAY". */
export const isPublicHoliday = (notes?: string | null, day?: string | null) =>
  /public holiday/i.test(notes ?? "") || (!!day && HK_PUBLIC_HOLIDAYS.has(day.slice(0, 10)));
