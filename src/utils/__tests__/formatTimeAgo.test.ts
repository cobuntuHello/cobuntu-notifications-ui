import { describe, it, expect } from "vitest";
import { formatTimeAgo } from "../formatTimeAgo";

describe("formatTimeAgo", () => {
  const now = new Date("2026-06-05T15:00:00.000Z");

  it("returns 'now' for under-a-minute differences", () => {
    expect(formatTimeAgo("2026-06-05T14:59:30.000Z", now)).toBe("now");
  });

  it("returns minutes for under-an-hour differences", () => {
    expect(formatTimeAgo("2026-06-05T14:30:00.000Z", now)).toBe("30 min ago");
  });

  it("returns 'hour' singular for 1 hour", () => {
    expect(formatTimeAgo("2026-06-05T14:00:00.000Z", now)).toBe("1 hour ago");
  });

  it("returns 'hours' plural for 5 hours", () => {
    expect(formatTimeAgo("2026-06-05T10:00:00.000Z", now)).toBe("5 hours ago");
  });

  it("returns days under a week", () => {
    expect(formatTimeAgo("2026-06-02T15:00:00.000Z", now)).toBe("3 days ago");
  });

  it("returns weeks under a month", () => {
    expect(formatTimeAgo("2026-05-22T15:00:00.000Z", now)).toBe("2 weeks ago");
  });

  it("returns months under a year", () => {
    expect(formatTimeAgo("2026-02-05T15:00:00.000Z", now)).toBe("4 months ago");
  });

  it("returns years past 12 months", () => {
    expect(formatTimeAgo("2024-06-05T15:00:00.000Z", now)).toBe("2 years ago");
  });

  it("returns empty string for an invalid date string", () => {
    expect(formatTimeAgo("not-a-date", now)).toBe("");
  });
});
