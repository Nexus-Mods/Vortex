/** What happens to a tracked install, as its listeners hear it. */
export type InstallEvent =
  // the install ended by itself: installed as `modId`, or failed with `error`
  | { type: "finished"; error: Error | null | undefined; modId: string | null | undefined }
  // the stall watchdog failed the install. Its work can't be cancelled and may still finish.
  | { type: "abandoned"; error: Error; modId: string }
  // an abandoned install succeeded after all
  | { type: "late-success"; modId: string };

export type InstallListener = (event: InstallEvent) => void;

/**
 * Everyone who wants to hear what happens to one tracked install: the caller waiting on its
 * outcome, the concurrency slot it holds, the collection orchestration it belongs to. Each adds a
 * listener and picks out the events it cares about, so the install reports in one place.
 */
export class InstallListeners {
  #listeners: InstallListener[] = [];

  /** @returns a function that removes the listener again */
  public add(listener: InstallListener): () => void {
    this.#listeners.push(listener);
    return () => {
      const idx = this.#listeners.indexOf(listener);
      if (idx !== -1) {
        this.#listeners.splice(idx, 1);
      }
    };
  }

  /**
   * Tells every listener, in the order they were added. A listener that throws doesn't keep the
   * event from the others; the first error is rethrown once all of them have run.
   */
  public emit(event: InstallEvent): void {
    const errors: unknown[] = [];
    // a listener may remove itself while being told
    for (const listener of [...this.#listeners]) {
      try {
        listener(event);
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length > 0) {
      throw errors[0];
    }
  }
}
