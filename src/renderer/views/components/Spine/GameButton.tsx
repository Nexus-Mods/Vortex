import React, { type ButtonHTMLAttributes, type FC } from "react";

import { joinClasses } from "../../../../tailwind/components/next/utils";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  imageSrc: string;
  isActive?: boolean;
}

export const GameButton: FC<GameButtonProps> = ({
  imageSrc,
  isActive,
  ...props
}) => (
  <button
    className="group relative size-12 overflow-hidden rounded-lg"
    {...props}
  >
    <img
      alt=""
      className="absolute inset-0 size-full object-cover"
      src={imageSrc}
    />

    <span
      className={joinClasses([
        "absolute inset-0 z-1 rounded-lg transition-colors",
        isActive
          ? "border-2 border-neutral-strong"
          : "border border-stroke-weak group-hover:border-2 group-hover:border-neutral-strong",
      ])}
    />
  </button>
);
