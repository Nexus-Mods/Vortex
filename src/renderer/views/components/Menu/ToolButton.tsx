import React, { type ButtonHTMLAttributes, type FC } from "react";

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  imageSrc: string;
}

export const ToolButton: FC<ToolButtonProps> = ({ imageSrc, ...props }) => (
  <button
    className="hover-overlay relative size-8 shrink-0 rounded-sm border border-stroke-moderate before:z-1"
    {...props}
  >
    <img
      alt=""
      className="absolute inset-0 size-full object-cover"
      src={imageSrc}
    />

    <span className="absolute inset-0 z-1 rounded-sm border border-stroke-moderate" />
  </button>
);
