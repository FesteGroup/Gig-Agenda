import { describe, it, expect } from "vitest";
import { coversShift, resolveAvail } from "./availability";

describe("availability", () => {
  it("available all day covers any shift", () => {
    expect(coversShift({ status: "available", start_time: null, end_time: null }, "17:30", "22:30")).toBe(true);
  });
  it("available 18:00–23:00 does not cover a 17:30 start", () => {
    expect(coversShift({ status: "partial", start_time: "18:00", end_time: "23:00" }, "17:30", "22:30")).toBe(false);
  });
  it("available 17:00–02:00 covers 18:00–01:00", () => {
    expect(coversShift({ status: "partial", start_time: "17:00", end_time: "02:00" }, "18:00", "01:00")).toBe(true);
  });
  it("unavailable never covers", () => {
    expect(coversShift({ status: "unavailable", start_time: null, end_time: null }, "10:00", "12:00")).toBe(false);
  });
  it("day entry overrides weekly pattern (Monday unavailable)", () => {
    const patterns = [{ weekday: 1, status: "unavailable" as const, start_time: null, end_time: null }];
    expect(resolveAvail("2026-11-16", null, patterns)?.status).toBe("unavailable");
    expect(resolveAvail("2026-11-16", { status: "available", start_time: null, end_time: null }, patterns)?.status).toBe("available");
  });
});
