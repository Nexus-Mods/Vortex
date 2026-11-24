import { describe, it, expect } from "vitest";

import type { TFunction } from "./i18n";
import relativeTime from "./relativeTime";

const t = (key: unknown) => key;

/** A `t` that puts the count before the key, to see which count a label gets. */
const counted = ((key: string, options?: { count?: number }) =>
  `${options?.count} ${key}`) as unknown as TFunction;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe("relativeTime", () => {
  it("returns a time value", function () {
    const date = new Date();
    const result = relativeTime(date, t);
    expect(result).toEqual("seconds ago");
  });

  it("returns a time value (minute test)", function () {
    const now = new Date();
    now.setMinutes(now.getMinutes() - 1);
    const result = relativeTime(now, t);
    expect(result).toEqual("{{ count }} minute ago");
  });

  it("returns a time value (hour test)", function () {
    const now = new Date();
    now.setHours(now.getHours() - 1);
    const result = relativeTime(now, t);
    expect(result).toEqual("{{ count }} hour ago");
  });

  it("returns a time value (day test)", function () {
    const now = new Date();
    now.setHours(now.getHours() - 24);
    const result = relativeTime(now, t);
    expect(result).toEqual("{{ count }} day ago");
  });

  it("returns a time value (week test)", function () {
    // Use a fixed millisecond offset to avoid DST boundary issues
    const now = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const result = relativeTime(now, t);
    expect(result).toEqual("{{ count }} week ago");
  });

  it.each([6.6, 7, 7.4])("says %s days, rounded, as 7 days, never 0 weeks", (days) => {
    expect(relativeTime(daysAgo(days), counted)).toBe("7 {{ count }} day ago");
  });

  it("says a week from 7.5 days", function () {
    expect(relativeTime(daysAgo(7.5), counted)).toBe("1 {{ count }} week ago");
  });

  it("returns a time value (month test)", function () {
    const now = new Date();
    now.setMonth(now.getMonth() - 2);
    const result = relativeTime(now, t);
    expect(result).toEqual("{{ count }} month ago");
  });

  it("returns a time value (year test)", function () {
    const now = new Date();
    now.setFullYear(now.getFullYear() - 1);
    const result = relativeTime(now, t);
    expect(result).toEqual("{{ count }} year ago");
  });
});
