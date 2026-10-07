export type CollectionUpdatePrompt =
  | { kind: "single"; collectionNames: string[] }
  | { kind: "batch"; collectionNames: string[]; hasNonCollectionMods: boolean };

export type CollectionUpdateChoice = "all" | "non-collection" | "cancel";

export interface IPendingCollectionUpdatePrompt {
  id: number;
  prompt: CollectionUpdatePrompt;
  resolve: (choice: CollectionUpdateChoice) => void;
}

// Prompts are shown one at a time, oldest first, so a second click while one is open waits its turn.
const queue: IPendingCollectionUpdatePrompt[] = [];
// The dialog host is the only subscriber, so no listeners means nothing can show a prompt.
const listeners = new Set<() => void>();
let nextId = 0;

const notify = () => listeners.forEach((listener) => listener());

export const subscribeToCollectionUpdatePrompts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);

    // Nobody left to answer, and an update must never go ahead unconfirmed, so cancel what waits.
    if (listeners.size === 0) {
      queue.splice(0).forEach((pending) => pending.resolve("cancel"));
    }
  };
};

/** The prompt to show now, undefined when none is waiting. Stable until the queue changes. */
export const currentCollectionUpdatePrompt = (): IPendingCollectionUpdatePrompt | undefined =>
  queue[0];

/**
 * Resolves once the user answers the prompt, in the order prompts were asked. Cancels straight
 * away when no dialog host is mounted, so callers never wait on a prompt nobody can show.
 */
export const askCollectionUpdate = (
  prompt: CollectionUpdatePrompt,
): Promise<CollectionUpdateChoice> =>
  listeners.size === 0
    ? Promise.resolve("cancel")
    : new Promise((resolve) => {
        queue.push({ id: nextId++, prompt, resolve });
        notify();
      });

/** Answers the prompt on screen and moves on to the next one waiting. */
export const answerCollectionUpdate = (choice: CollectionUpdateChoice): void => {
  queue.shift()?.resolve(choice);
  notify();
};
