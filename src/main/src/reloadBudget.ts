/**
 * Bounds how often a dead renderer is reloaded. A renderer that dies on every
 * launch would otherwise be reloaded indefinitely
 */
export class ReloadBudget {
  readonly #deaths: number[] = [];
  readonly #max: number;
  readonly #windowMs: number;

  constructor(max: number, windowMs: number) {
    this.#max = max;
    this.#windowMs = windowMs;
  }

  /** Records a death at `now` and returns whether reloading is still worth trying. */
  public allow(now: number = Date.now()): boolean {
    const firstInWindow = this.#deaths.findIndex((death) => now - death < this.#windowMs);
    this.#deaths.splice(0, firstInWindow === -1 ? this.#deaths.length : firstInWindow);
    this.#deaths.push(now);
    return this.#deaths.length <= this.#max;
  }

  /** Deaths inside the current window, including the one just recorded. */
  public get count(): number {
    return this.#deaths.length;
  }
}
