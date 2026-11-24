import { describe, expect, it } from "vitest";

import { FEEDBACK_ID_PATTERN, newFeedbackId } from "./feedbackIds";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const allOnes = (bytes: Uint8Array): void => {
  bytes.fill(0xff);
};
const allZeroes = (bytes: Uint8Array): void => {
  bytes.fill(0);
};

/** The seconds an id's first seven characters stand for. */
const secondsOf = (id: string): number =>
  [...id.replace(/-/g, "").slice(0, 7)].reduce(
    (total, char) => total * 32 + ALPHABET.indexOf(char),
    0,
  );

describe("newFeedbackId", () => {
  it("is sixteen base32 characters in four groups", () => {
    const id = newFeedbackId();

    expect(id).toMatch(FEEDBACK_ID_PATTERN);
    expect(id).toHaveLength(19);
  });

  it("starts with the time in seconds, then the random characters", () => {
    const now = Date.UTC(2026, 10, 19, 12, 0, 0) + 999;

    const id = newFeedbackId(now, allOnes);

    expect(secondsOf(id)).toBe(Date.UTC(2026, 10, 19, 12, 0, 0) / 1000);
    expect(id.replace(/-/g, "").slice(7)).toBe("ZZZZZZZZZ");
  });

  it("sorts by creation time, as text", () => {
    const earlier = newFeedbackId(1_000_000_000_000, allOnes);
    const later = newFeedbackId(1_000_000_001_000, allZeroes);

    expect(earlier < later).toBe(true);
  });

  it("keeps a time beyond 32 bits", () => {
    const seconds = 2 ** 34 + 12345;

    expect(secondsOf(newFeedbackId(seconds * 1000))).toBe(seconds);
  });

  it("never uses the letters that are mistaken for digits or each other", () => {
    const ids = Array.from({ length: 200 }, () => newFeedbackId()).join("");

    expect(ids).not.toMatch(/[ILOU]/);
  });

  it("differs between calls at the same time", () => {
    expect(newFeedbackId(1)).not.toBe(newFeedbackId(1));
  });
});
