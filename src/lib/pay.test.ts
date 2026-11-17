import { describe, expect, it } from "vitest";
import { shiftPay, splitHours } from "./pay";

describe("Relish pay rules", () => {
  it("server: 650 for first 4h, 150 after", () => {
    expect(shiftPay({ position: "Server", start: "14:00", end: "18:00" })).toBe(650);
    expect(shiftPay({ position: "Server", start: "09:00", end: "19:00" })).toBe(650 + 6 * 150);
  });
  it("senior server: 750 + 180", () => {
    expect(shiftPay({ position: "Server", start: "15:30", end: "22:45", personalRate: 180 })).toBe(750 + 3.25 * 180);
  });
  it("server after midnight at 200/h", () => {
    expect(shiftPay({ position: "Server", start: "18:00", end: "01:00" })).toBe(650 + 2 * 150 + 200);
  });
  it("bartender 200/h, 300 after midnight", () => {
    expect(shiftPay({ position: "Bartender", start: "19:00", end: "00:30" })).toBe(5 * 200 + 0.5 * 300);
  });
  it("public holiday doubles", () => {
    expect(shiftPay({ position: "Server", start: "09:00", end: "19:00", publicHoliday: true })).toBe(2 * 1550);
  });
  it("split shift via break", () => {
    expect(splitHours("06:30", "15:00", 90).total).toBe(7);
  });
});
