import { describe, it, expect } from "vitest";
import { relativeTime } from "../../src/timeAgo.js";

describe("relativeTime", () => {
  it("returns 'Just now' for a timestamp under a minute old", () => {
    expect(relativeTime(new Date(Date.now() - 10 * 1000))).toBe("Just now");
  });

  it("returns minutes ago for a timestamp under an hour old", () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60 * 1000))).toBe("5m ago");
  });

  it("returns hours ago for a timestamp under a day old", () => {
    expect(relativeTime(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe("3h ago");
  });

  it("returns days ago for a timestamp under a week old", () => {
    expect(relativeTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))).toBe("2d ago");
  });

  it("returns a localized month/day string for a far-past timestamp", () => {
    const farDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expected = farDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    expect(relativeTime(farDate)).toBe(expected);
  });
});
