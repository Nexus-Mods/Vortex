import { useEffect, useState } from "react";

/**
 * A picture's average colour, as `rgb()`, once it loads: drawn into a 1×1 canvas, which the
 * browser averages, then read back. Undefined until then, and for a picture whose host
 * doesn't let another origin read it, as reading needs CORS where drawing alone doesn't.
 */
export const useImageColour = (src: string | undefined): string | undefined => {
  // Kept with the picture it's for, so another's never shows while this one loads.
  const [colour, setColour] = useState<{ src: string; value: string }>();

  useEffect(() => {
    if (!src) {
      return;
    }

    const image = new window.Image();
    image.crossOrigin = "anonymous";

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, 1, 1);

      try {
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        setColour({ src, value: `rgb(${red} ${green} ${blue})` });
      } catch {
        // A host without CORS taints the canvas: no colour, and no tint.
      }
    };

    image.src = src;

    return () => {
      image.onload = null;
    };
  }, [src]);

  if (!colour || colour.src !== src) {
    return undefined;
  }

  return colour.value;
};
