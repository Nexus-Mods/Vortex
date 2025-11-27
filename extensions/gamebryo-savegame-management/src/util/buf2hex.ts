export function buf2hex(buffer: Uint8ClampedArray): string {
  return [...buffer]
    .map(b => (b.toString(16) as any).padStart(2, '0'))
    .join('');
}

export function hex2buf(input: string): Uint8ClampedArray {
  return new Uint8ClampedArray(input.match(/../g).map(i => parseInt(i, 16)));
}
