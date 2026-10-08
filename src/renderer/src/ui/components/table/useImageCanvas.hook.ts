import { useEffect, useRef } from "react";

/**
 * Draws a picture into a canvas, scaled to the canvas's own size, once it loads. At 1×1 the
 * browser averages it into one colour. Draws only, never reads back, so a picture from
 * another origin needs no CORS.
 */
export const useImageCanvas = (src: string) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = new window.Image();

    image.onload = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (!canvas || !context) {
        return;
      }

      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };

    image.src = src;

    return () => (image.onload = null);
  }, [src]);

  return canvasRef;
};
