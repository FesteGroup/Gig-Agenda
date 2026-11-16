import { minutesOf, shiftHours } from "./time";

export type Overtime = { start_hour: number; end_hour: number | null; client_rate: number };

/**
 * Client charge for one person on one shift.
 * Hours after midnight fall into overtime brackets (when enabled) and are billed at the bracket's
 * client rate instead of the normal rate. Break minutes are deducted from normal-rate time.
 */
export function clientChargeForShift(
  start: string,
  end: string,
  breakMinutes: number,
  clientRate: number,
  overtime: Overtime[] = [],
  applyOvertime = false,
): number {
  const total = shiftHours(start, end, breakMinutes);
  if (!applyOvertime || overtime.length === 0) return total * clientRate;
  const s = minutesOf(start);
  let e = minutesOf(end);
  if (e <= s) e += 1440;
  let otCharge = 0;
  let otHours = 0;
  for (const b of overtime) {
    const bStart = 1440 + b.start_hour * 60;
    const bEnd = b.end_hour == null ? 1440 * 2 : 1440 + b.end_hour * 60;
    const mins = Math.max(0, Math.min(e, bEnd) - Math.max(s, bStart));
    otHours += mins / 60;
    otCharge += (mins / 60) * b.client_rate;
  }
  const normalHours = Math.max(0, total - otHours);
  return normalHours * clientRate + otCharge;
}

export function staffCost(hours: number, personalRate: number | null | undefined, positionRate: number | null | undefined): number | null {
  const rate = personalRate ?? positionRate;
  return rate == null ? null : rate * hours;
}
