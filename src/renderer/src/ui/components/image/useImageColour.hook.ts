import { useEffect, useState } from "react";

/** Each picture's average colour, once worked out, so a row that remounts has it at once. */
const known = new Map<string, string>();
/** The pictures being worked out, so many asking at once load each only once. */
const pending = new Map<string, Promise<string | undefined>>();

/**
 * A picture's average colour, as `rgb()`: drawn into a 1×1 canvas, which the browser
 * averages, then read back. Undefined for a picture that doesn't load, or whose host doesn't
 * let another origin read it, as reading needs CORS where drawing alone doesn't.
 */
const averageColour = (src: string): Promise<string | undefined> => {
  let colour = pending.get(src);
  if (colour !== undefined) {
    return colour;
  }

  colour = new Promise<string | undefined>((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onerror = () => resolve(undefined);

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(undefined);
        return;
      }

      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, 1, 1);

      try {
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        resolve(`rgb(${red} ${green} ${blue})`);
      } catch {
        // A host without CORS taints the canvas: no colour, and no tint.
        resolve(undefined);
      }
    };

    image.src = src;
  }).then((value) => {
    pending.delete(src);
    if (value !== undefined) {
      known.set(src, value);
    }
    return value;
  });

  pending.set(src, colour);
  return colour;
};

/**
 * A picture's average colour, as `rgb()`, worked out once per picture for the session.
 * Undefined until it's known, and for a picture whose colour can't be read.
 */
export const useImageColour = (src: string | undefined): string | undefined => {
  // Kept with the picture it's for, so another's never shows while this one loads.
  const [loaded, setLoaded] = useState<{ src: string; value: string }>();

  useEffect(() => {
    if (!src || known.has(src)) {
      return;
    }

    let current = true;
    void averageColour(src).then((value) => {
      if (current && value !== undefined) {
        setLoaded({ src, value });
      }
    });

    return () => {
      current = false;
    };
  }, [src]);

  if (!src) {
    return undefined;
  }

  const cached = known.get(src);
  if (cached !== undefined) {
    return cached;
  }

  if (!loaded || loaded.src !== src) {
    return undefined;
  }

  return loaded.value;
};
