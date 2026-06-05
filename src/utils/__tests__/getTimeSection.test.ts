import { describe, it, expect } from "vitest";
import { getTimeSection } from "../getTimeSection";

describe("getTimeSection", () => {
  // Anchor `now` at 2026-06-05T15:00:00Z so the boundaries are
  // deterministic — without a fixed `now` the tests drift as the clock
  // ticks past midnight.
  const now = new Date("2026-06-05T15:00:00.000Z");

  it("returns Today for a notification timestamped earlier today", () => {
    expect(getTimeSection("2026-06-05T08:00:00.000Z", now)).toBe("Today");
  });

  it("returns Yesterday for a notification timestamped on the previous calendar day", () => {
    expect(getTimeSection("2026-06-04T23:30:00.000Z", now)).toBe("Yesterday");
  });

  it("returns This Week for a notification 3 days old", () => {
    expect(getTimeSection("2026-06-02T12:00:00.000Z", now)).toBe("This Week");
  });

  it("returns This Month for a notification 10 days old", () => {
    expect(getTimeSection("2026-05-26T12:00:00.000Z", now)).toBe("This Month");
  });

  it("returns Earlier for a notification 60 days old", () => {
    expect(getTimeSection("2026-04-06T12:00:00.000Z", now)).toBe("Earlier");
  });

  it("treats a notification from 11pm yesterday as Yesterday even when checking at 1am", () => {
    // Calendar-aware boundary, not 24-hour rolling. Regression-guards
    // the bug where rolling windows showed "Today" for very-recent-
    // but-different-calendar-day notifications.
    const checkAt = new Date("2026-06-05T01:00:00.000Z");
    expect(getTimeSection("2026-06-04T23:00:00.000Z", checkAt)).toBe("Yesterday");
  });
});
