import { describe, it, expect } from "vitest";

import type { IFeedbackFile } from "../types/IFeedbackFile";
import * as sessionActions from "./session";

describe("addFeedbackFile", () => {
  it("creates the correct action", () => {
    const file: IFeedbackFile = {
      filename: "screenshot.png",
      filePath: "/tmp/screenshot.png",
      type: "screenshot",
      size: 1024,
    };
    expect(sessionActions.addFeedbackFile(file)).toEqual({
      error: false,
      type: "ADD_FEEDBACK_FILE",
      payload: { feedbackFile: file },
    });
  });
});

describe("removeFeedbackFile", () => {
  it("creates the correct action", () => {
    expect(sessionActions.removeFeedbackFile("feedbackFileId1")).toEqual({
      error: false,
      type: "REMOVE_FEEDBACK_FILE",
      payload: { feedbackFileId: "feedbackFileId1" },
    });
  });
});

describe("clearFeedbackFiles", () => {
  it("creates the correct action", () => {
    expect(sessionActions.clearFeedbackFiles()).toEqual({
      error: false,
      type: "CLEAR_FEEDBACK_FILES",
      payload: undefined,
    });
  });
});
