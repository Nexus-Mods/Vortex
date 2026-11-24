import { describe, expect, it } from "vitest";

import { feedbackRecordId } from "./recordIds";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("feedbackRecordId", () => {
  const feedbackId = "1NG5-K8H7-QX3M-9T2B";

  it("is the same every time for the same record", () => {
    expect(feedbackRecordId(feedbackId, "feedback_state", "settings")).toBe(
      feedbackRecordId(feedbackId, "feedback_state", "settings"),
    );
    expect(feedbackRecordId(feedbackId, "feedback_state", "settings")).toMatch(UUID_RE);
  });

  it("is the id it has always been, since the service stores a record id once", () => {
    expect(feedbackRecordId(feedbackId, "feedback_state", "settings")).toBe(
      "b46cf319-9af4-508c-b22c-3016add3b22a",
    );
  });

  it("differs by type, key and feedback", () => {
    const ids = new Set([
      feedbackRecordId(feedbackId, "feedback_state", "settings"),
      feedbackRecordId(feedbackId, "feedback_state", "session"),
      feedbackRecordId(feedbackId, "feedback_log", "settings"),
      feedbackRecordId("1NG5-K8H7-QX3M-9T2C", "feedback_state", "settings"),
    ]);

    expect(ids.size).toBe(4);
  });
});
