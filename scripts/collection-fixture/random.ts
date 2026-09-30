/**
 * A small seeded PRNG (mulberry32) so a fixture is reproducible from its spec. Node's
 * `crypto.randomBytes` would make every run differ, and a fixture that changes between runs
 * cannot be compared across Vortex versions.
 */
export class SeededRandom {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** uniform float in [0, 1) */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  hex(length: number): string {
    let out = "";
    while (out.length < length) {
      out += this.int(0, 15).toString(16);
    }
    return out;
  }

  /** a shortid-like token, the shape Vortex uses for download ids and reference tags */
  token(length = 9): string {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let out = "";
    for (let i = 0; i < length; i++) {
      out += alphabet[this.int(0, alphabet.length - 1)];
    }
    return out;
  }

  uuid(): string {
    const h = this.hex(32);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }

  bytes(length: number): Buffer {
    const buf = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      buf[i] = this.int(0, 255);
    }
    return buf;
  }
}
