import { mdiDownload, mdiHome, mdiPlus, mdiPuzzle } from "@mdi/js";
import React, { type ButtonHTMLAttributes } from "react";

import { Icon } from "../../../tailwind/components/next/icon";
import { joinClasses } from "../../../tailwind/components/next/utils";

const Button = ({
  className,
  iconPath,
  isActive,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  iconPath: string;
  isActive?: boolean;
}) => (
  <button
    className={joinClasses([
      className,
      "flex size-12 items-center justify-center transition-colors",
      "hover:border-neutral-strong hover:bg-surface-translucent-low hover:text-neutral-strong",
      isActive
        ? "border-neutral-strong bg-surface-translucent-low text-neutral-strong"
        : "border-stroke-weak",
    ])}
    {...props}
  >
    <Icon className="transition-colors" path={iconPath} size="lg" />
  </button>
);

const GameButton = ({
  imageSrc,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  imageSrc: string;
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

    <span className="absolute inset-0 z-1 rounded-lg border border-stroke-weak transition-colors group-hover:border-2 group-hover:border-neutral-strong" />
  </button>
);

export const Spine = () => (
  <div className="flex shrink-0 flex-col justify-between border-r border-stroke-weak p-3">
    <div className="flex flex-col gap-y-3">
      <Button
        className="rounded-lg border-2 text-neutral-moderate"
        iconPath={mdiHome}
        isActive={true}
      />

      <GameButton imageSrc="https://images.nexusmods.com/images/games/v2/110/thumbnail.jpg" />

      <GameButton imageSrc="https://images.nexusmods.com/images/games/v2/3333/thumbnail.jpg" />

      <GameButton imageSrc="https://images.nexusmods.com/images/games/v2/1303/thumbnail.jpg" />

      <Button
        className="rounded-lg border-2 border-dotted text-neutral-moderate hover:border-solid"
        iconPath={mdiPlus}
      />
    </div>

    <div className="flex flex-col gap-y-3">
      <Button
        className="rounded-lg text-neutral-moderate hover:border-2"
        iconPath={mdiPuzzle}
      />

      <Button
        className="rounded-full border-2 text-neutral-strong"
        iconPath={mdiDownload}
      />
    </div>
  </div>
);
