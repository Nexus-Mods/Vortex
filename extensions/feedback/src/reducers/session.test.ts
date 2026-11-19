import { describe, it, expect } from "vitest";

import type { IFeedbackFile } from "../types/IFeedbackFile";
import type { IFeedbackSessionState } from "../types/state";
import { sessionReducer } from "./session";

function makeState(feedbackFiles: { [fileId: string]: IFeedbackFile }): IFeedbackSessionState {
  return { ...sessionReducer.defaults, feedbackFiles };
}

function makeFile(filename: string, filePath: string, type: string, size: number): IFeedbackFile {
  return { filename, filePath, type, size };
}

describe("addFeedbackFile", () => {
  it("adds a new feedback file", () => {
    const input = makeState({});
    const feedbackFile = makeFile("filename1", "filePath", "screenshot", 100);
    const result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, {
      feedbackFile: feedbackFile,
    });
    expect(result).toEqual(makeState({ filename1: feedbackFile }));
  });
  it("overwrites an existing feedback file", () => {
    const input = makeState({
      filename1: makeFile("filename1", "", "", 0),
    });
    const feedbackFile = makeFile("filename1", "filePath", "screenshot", 100);
    const result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, {
      feedbackFile: feedbackFile,
    });
    expect(result).toEqual(makeState({ filename1: feedbackFile }));
  });
  it("affects only the right feedback file", () => {
    const input = makeState({
      filename1: makeFile("filename1", "", "", 0),
      filename2: makeFile("filename2", "", "", 0),
    });
    const feedbackFile = makeFile("filename2", "filePath", "screenshot", 100);
    const oldFeedbackFile = makeFile("filename1", "", "", 0);
    const result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, {
      feedbackFile: feedbackFile,
    });
    expect(result).toEqual(makeState({ filename1: oldFeedbackFile, filename2: feedbackFile }));
  });
});

describe("removeFeedbackFile", () => {
  it("removes the feedback file", () => {
    const input = makeState({
      filename1: makeFile("filename1", "filepath", "screenshot", 100),
    });
    const result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, {
      feedbackFileId: "filename1",
    });
    expect(result).toEqual(makeState({}));
  });
  it("does nothing if the feedback file doesn't exist", () => {
    const input = makeState({
      filename1: makeFile("filename1", "filepath", "screenshot", 100),
    });
    const result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, {
      feedbackFileId: "filename2",
    });
    expect(result).toEqual(
      makeState({
        filename1: makeFile("filename1", "filepath", "screenshot", 100),
      }),
    );
  });
  it("affects only the right feedback file", () => {
    const input = makeState({
      filename1: makeFile("filename1", "filepath", "screenshot", 100),
      filename2: makeFile("filename2", "filepath2", "screenshot", 200),
    });
    const result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, {
      feedbackFileId: "filename2",
    });
    expect(result).toEqual(
      makeState({
        filename1: makeFile("filename1", "filepath", "screenshot", 100),
      }),
    );
  });
});

describe("clearFeedbackFiles", () => {
  it("clears the feedback files", () => {
    const input = makeState({
      filename1: makeFile("filename1", "filepath", "screenshot", 100),
    });
    const result = sessionReducer.reducers.CLEAR_FEEDBACK_FILES(input, undefined);
    expect(result).toEqual(makeState({}));
  });
});
