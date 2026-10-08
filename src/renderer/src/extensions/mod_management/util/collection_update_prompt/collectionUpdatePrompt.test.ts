import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  answerCollectionUpdate,
  askCollectionUpdate,
  currentCollectionUpdatePrompt,
  subscribeToCollectionUpdatePrompts,
} from "./collectionUpdatePrompt";

const single = (name: string) => ({ kind: "single" as const, collectionNames: [name] });

describe("collectionUpdatePrompt", () => {
  describe("with a dialog host mounted", () => {
    let unmountHost: () => void;

    beforeEach(() => {
      unmountHost = subscribeToCollectionUpdatePrompts(() => undefined);
    });

    afterEach(() => {
      unmountHost();
    });

    it("has nothing to show until a prompt is asked", () => {
      expect(currentCollectionUpdatePrompt()).toBeUndefined();
    });

    it("resolves with the answer given to the prompt on screen", async () => {
      const answer = askCollectionUpdate(single("Pack"));

      expect(currentCollectionUpdatePrompt()?.prompt).toEqual(single("Pack"));

      answerCollectionUpdate("all");

      await expect(answer).resolves.toBe("all");
      expect(currentCollectionUpdatePrompt()).toBeUndefined();
    });

    it("shows prompts one at a time, in the order they were asked", async () => {
      const first = askCollectionUpdate(single("First"));
      const second = askCollectionUpdate(single("Second"));

      expect(currentCollectionUpdatePrompt()?.prompt).toEqual(single("First"));

      answerCollectionUpdate("cancel");

      expect(currentCollectionUpdatePrompt()?.prompt).toEqual(single("Second"));

      answerCollectionUpdate("all");

      await expect(first).resolves.toBe("cancel");
      await expect(second).resolves.toBe("all");
    });

    it("gives each prompt its own id", () => {
      void askCollectionUpdate(single("First"));
      const firstId = currentCollectionUpdatePrompt()?.id;
      answerCollectionUpdate("cancel");

      void askCollectionUpdate(single("Second"));
      const secondId = currentCollectionUpdatePrompt()?.id;
      answerCollectionUpdate("cancel");

      expect(secondId).not.toBe(firstId);
    });

    it("tells subscribers when a prompt arrives and when it is answered", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToCollectionUpdatePrompts(listener);

      void askCollectionUpdate(single("Pack"));
      answerCollectionUpdate("cancel");

      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
      void askCollectionUpdate(single("Pack"));
      answerCollectionUpdate("cancel");

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("ignores an answer when nothing is waiting", () => {
      expect(() => answerCollectionUpdate("all")).not.toThrow();
    });
  });

  describe("without a dialog host", () => {
    it("cancels straight away, so the update never goes ahead unconfirmed", async () => {
      await expect(askCollectionUpdate(single("Pack"))).resolves.toBe("cancel");

      expect(currentCollectionUpdatePrompt()).toBeUndefined();
    });

    it("cancels the prompts still waiting when the host goes away", async () => {
      const unmountHost = subscribeToCollectionUpdatePrompts(() => undefined);
      const first = askCollectionUpdate(single("First"));
      const second = askCollectionUpdate(single("Second"));

      unmountHost();

      await expect(first).resolves.toBe("cancel");
      await expect(second).resolves.toBe("cancel");
      expect(currentCollectionUpdatePrompt()).toBeUndefined();
    });
  });
});
