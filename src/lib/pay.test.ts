import { describe, expect, it } from "vitest";
import { isPublicHoliday, shiftPay, splitHours } from "./pay";
import { gingersClientCharge } from "./gingers";

describe("Relish pay rules", () => {
  it("server: 650 for first 4h, 150 after", () => {
    expect(shiftPay({ position: "Server", start: "14:00", end: "18:00" })).toBe(650);
    expect(shiftPay({ position: "Server", start: "09:00", end: "19:00" })).toBe(650 + 6 * 150);
  });
  it("senior server: 750 + 180", () => {
    expect(shiftPay({ position: "Server", start: "15:30", end: "22:45", personalRate: 180 })).toBe(
      750 + 3.25 * 180,
    );
  });
  it("server after midnight at 200/h", () => {
    expect(shiftPay({ position: "Server", start: "18:00", end: "01:00" })).toBe(
      650 + 2 * 150 + 200,
    );
  });
  it("bartender 200/h, 300 after midnight", () => {
    expect(shiftPay({ position: "Bartender", start: "19:00", end: "00:30" })).toBe(
      5 * 200 + 0.5 * 300,
    );
  });
  it("public holiday doubles", () => {
    expect(
      shiftPay({ position: "Server", start: "09:00", end: "19:00", publicHoliday: true }),
    ).toBe(2 * 1550);
  });
  it("split shift via break", () => {
    expect(splitHours("06:30", "15:00", 90).total).toBe(7);
  });
});

describe("Gingers rates", () => {
  it("flat hourly staff cost, doubled on holidays", () => {
    expect(
      shiftPay({ position: "Gingers · Waiter", start: "18:00", end: "23:00", positionRate: 150 }),
    ).toBe(750);
    expect(
      shiftPay({
        position: "Gingers · Waiter",
        start: "18:00",
        end: "23:00",
        positionRate: 150,
        publicHoliday: true,
      }),
    ).toBe(1500);
  });
  it("client charge with after-midnight and holiday rates", () => {
    expect(
      gingersClientCharge({
        position: "Gingers · F&B Manager",
        start: "20:00",
        end: "01:00",
        clientRate: 240,
      }),
    ).toBe(4 * 240 + 290);
    expect(
      gingersClientCharge({
        position: "Gingers · F&B Manager",
        start: "20:00",
        end: "01:00",
        clientRate: 240,
        publicHoliday: true,
      }),
    ).toBe(4 * 480 + 720);
    expect(
      gingersClientCharge({
        position: "Gingers · Bartender",
        start: "18:00",
        end: "22:00",
        clientRate: 300,
        publicHoliday: true,
      }),
    ).toBe(2400);
  });
  it("waiter holiday after midnight at 570", () => {
    expect(
      gingersClientCharge({
        position: "Gingers · Waiter",
        start: "20:00",
        end: "01:00",
        clientRate: 190,
        publicHoliday: true,
      }),
    ).toBe(4 * 380 + 570);
  });
  it("Hong Kong holidays by date, Sundays excluded", () => {
    expect(isPublicHoliday(null, "2026-12-25")).toBe(true);
    expect(isPublicHoliday(null, "2026-11-22")).toBe(false);
  });
});
