/** The largest width or height an image is given, as the site caps them. */
const MAX_SIZE = 3600;

/** A size given in pixels, if it is one, capped. */
export const pixels = (size: number | undefined) => {
  if (!size || !Number.isFinite(size) || size <= 0) {
    return undefined;
  }

  return Math.min(Math.round(size), MAX_SIZE);
};

/** The whole number a parameter starts with, or a pattern finds in it. */
export const numberIn = (value: string | undefined, pattern = /^\s*(\d+)/) => {
  const match = pattern.exec(value ?? "");

  if (!match) {
    return undefined;
  }

  return Number(match[1]);
};
