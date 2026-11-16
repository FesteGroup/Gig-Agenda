import { describe, it, expect } from "vitest";
import { clientChargeForShift, staffCost } from "./costs";
import { shiftHours } from "./time";

const OT = [
  { start_hour: 0, end_hour: 1, client_rate: 290 },
  { start_hour: 1, end_hour: 2, client_rate: 395 },
  { start_hour: 2, end_hour: 3, client_rate: 625 },
  { start_hour: 3, end_hour: null, client_rate: 1200 },
];

describe("costs", () => {
  it("server 17:30–22:30 at HK$190 bills 5 h = 950", () => {
    expect(clientChargeForShift("17:30", "22:30", 0, 190)).toBe(950);
  });
  it("break minutes are unpaid", () => {
    expect(shiftHours("17:30", "22:30", 30)).toBe(4.5);
  });
  it("shift to 01:00 with overtime bills midnight–1am at 290", () => {
    // 20:00–01:00 = 4 h normal at 190 + 1 h at 290
    expect(clientChargeForShift("20:00", "01:00", 0, 190, OT, true)).toBe(4 * 190 + 290);
  });
  it("shift to 03:30 uses every bracket", () => {
    expect(clientChargeForShift("22:00", "03:30", 0, 190, OT, true)).toBe(2 * 190 + 290 + 395 + 625 + 0.5 * 1200);
  });
  it("overtime off bills everything at normal rate", () => {
    expect(clientChargeForShift("20:00", "01:00", 0, 190, OT, false)).toBe(5 * 190);
  });
  it("personal hourly cost overrides position cost", () => {
    expect(staffCost(5, 120, 100)).toBe(600);
    expect(staffCost(5, null, 100)).toBe(500);
    expect(staffCost(5, null, null)).toBeNull();
  });
});
