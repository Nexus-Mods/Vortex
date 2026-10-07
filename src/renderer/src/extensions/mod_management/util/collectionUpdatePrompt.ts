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
const listeners = new Set<() => void>();
let nextId = 0;

const notify = () => listeners.forEach((listener) => listener());

export const subscribeToCollectionUpdatePrompts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The prompt to show now, undefined when none is waiting. Stable until the queue changes. */
export const currentCollectionUpdatePrompt = (): IPendingCollectionUpdatePrompt | undefined =>
  queue[0];

/** Resolves once the user answers the prompt, in the order prompts were asked. */
export const askCollectionUpdate = (
  prompt: CollectionUpdatePrompt,
): Promise<CollectionUpdateChoice> =>
  new Promise((resolve) => {
    queue.push({ id: nextId++, prompt, resolve });
    notify();
  });

/** Answers the prompt on screen and moves on to the next one waiting. */
export const answerCollectionUpdate = (choice: CollectionUpdateChoice): void => {
  queue.shift()?.resolve(choice);
  notify();
};
