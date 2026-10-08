import { describe, expect, it } from "vitest";

import type { IDialog } from "../../types/IDialog";
import { rememberedDialogIds } from "./rememberedDialogIds";

const dialogWith = (id: string, title: string, actions: string[]): IDialog => ({
  id,
  type: "question",
  title,
  content: { text: "t" },
  defaultAction: actions[0],
  actions,
});

describe("rememberedDialogIds", () => {
  it("includes the current dialog", () => {
    const current = dialogWith("a", "Title", ["Cancel", "Ignore"]);

    expect(rememberedDialogIds([current], current)).toEqual(["a"]);
  });

  it("includes queued dialogs with the same title", () => {
    const current = dialogWith("a", "Title", ["Cancel", "Ignore"]);
    const sameTitle = dialogWith("b", "Title", ["Yes", "No"]);

    expect(rememberedDialogIds([current, sameTitle], current)).toEqual(["a", "b"]);
  });

  it("includes queued dialogs with the same actions", () => {
    const current = dialogWith("a", "Title", ["Cancel", "Ignore"]);
    const sameActions = dialogWith("b", "Other title", ["Cancel", "Ignore"]);

    expect(rememberedDialogIds([current, sameActions], current)).toEqual(["a", "b"]);
  });

  it("leaves out dialogs with a different title and different actions", () => {
    const current = dialogWith("a", "Title", ["Cancel", "Ignore"]);
    const unrelated = dialogWith("b", "Other title", ["Yes", "No"]);

    expect(rememberedDialogIds([current, unrelated], current)).toEqual(["a"]);
  });
});
