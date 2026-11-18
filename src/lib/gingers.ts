import { splitHours } from "./pay";

/**
 * Gingers staff positions (from Gingers' Puree price list), kept apart from Relish's positions.
 * Rates are HKD per hour. Gingers positions share one colour family (gold, like the Gingers event badge) so they stand out from Relish.
 * - After midnight: the listed after-midnight client rate (when Puree has one).
 * - Public holidays: fees are doubled (client rate and staff cost). Holiday after-midnight rates are taken from Puree
 *   as listed (F&B Manager HK$720, Waiter and Commis Chef HK$570).
 */
export const GINGERS_COLOR = "#b38f12";

export type GingersPosition = {
  name: string;
  color: string;
  sort: number;
  hourlyCost: number | null;
  clientRate: number;
  afterMidnight?: number;
  holidayAfterMidnight?: number;
};

export const GINGERS_POSITIONS: GingersPosition[] = [
  {
    name: "Gingers · F&B Manager",
    color: "#7c3aed",
    sort: 101,
    hourlyCost: 195,
    clientRate: 240,
    afterMidnight: 290,
    holidayAfterMidnight: 720,
  },
  { name: "Gingers · Bartender", color: "#0ea5e9", sort: 102, hourlyCost: 200, clientRate: 300 },
  {
    name: "Gingers · Waiter",
    color: "#f97316",
    sort: 103,
    hourlyCost: 150,
    clientRate: 190,
    afterMidnight: 240,
    holidayAfterMidnight: 570,
  },
  {
    name: "Gingers · Commis Chef",
    color: "#db2777",
    sort: 104,
    hourlyCost: null,
    clientRate: 190,
    afterMidnight: 240,
    holidayAfterMidnight: 570,
  },
];

/** Gold shades the Gingers positions used before; replaced once by their own colours. */
export const OLD_GINGERS_COLORS = ["#8a6d0b", "#b38f12", "#d4b03a", "#e6c96b"];

export const isGingersPosition = (name: string | null | undefined) =>
  /^gingers\b/i.test((name ?? "").trim());

/** Position name without the "Gingers · " prefix, for compact labels next to a Gingers badge. */
export const shortPositionName = (name: string | null | undefined) =>
  (name ?? "").replace(/^gingers\s*[·:-]?\s*/i, "");

export const gingersDefOf = (name: string | null | undefined) =>
  GINGERS_POSITIONS.find((p) => p.name.toLowerCase() === (name ?? "").trim().toLowerCase()) ??
  GINGERS_POSITIONS.find(
    (p) => shortPositionName(p.name).toLowerCase() === shortPositionName(name).toLowerCase(),
  );

/** Client charge for one Gingers person on one shift. */
export function gingersClientCharge(opts: {
  position: string | null | undefined;
  start: string;
  end: string;
  breakMinutes?: number | undefined;
  clientRate: number;
  publicHoliday?: boolean | undefined;
}): number {
  const def = gingersDefOf(opts.position);
  const { normal, night } = splitHours(opts.start, opts.end, opts.breakMinutes ?? 0);
  const nightRate = def?.afterMidnight ?? opts.clientRate;
  if (!opts.publicHoliday) return normal * opts.clientRate + night * nightRate;
  const holidayNight = def?.holidayAfterMidnight ?? nightRate * 2;
  return normal * opts.clientRate * 2 + night * holidayNight;
}

/** Staff cost for one Gingers person on one shift: flat hourly cost, doubled on public holidays. */
export function gingersShiftPay(opts: {
  start: string;
  end: string;
  breakMinutes?: number | undefined;
  rate: number | null | undefined;
  publicHoliday?: boolean | undefined;
}): number | null {
  if (opts.rate == null) return null;
  const { total } = splitHours(opts.start, opts.end, opts.breakMinutes ?? 0);
  return total * Number(opts.rate) * (opts.publicHoliday ? 2 : 1);
}
