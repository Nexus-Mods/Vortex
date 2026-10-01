import React, { useEffect, useRef } from "react";

// Small enough that stretching it over the row smooths the picture into a wash of its colours.
const WIDTH = 16;
const HEIGHT = 4;

/**
 * A group row's background tinted from a picture: drawn once into a tiny canvas that CSS
 * stretches over the row, so there's no blur filter to repaint as the table scrolls.
 */
export const TableGroupWash = ({ src }: { src: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = new window.Image();

    image.onload = () => {
      const context = canvasRef.current?.getContext("2d");

      if (!context) {
        return;
      }

      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    };

    image.src = src;

    return () => (image.onload = null);
  }, [src]);

  return (
    <canvas
      aria-hidden={true}
      className="nxm-table-group-wash"
      height={HEIGHT}
      ref={canvasRef}
      width={WIDTH}
    />
  );
};
