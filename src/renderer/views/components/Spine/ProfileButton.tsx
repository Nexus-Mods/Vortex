import { mdiLoading, mdiPlay } from "@mdi/js";
import React, { type ButtonHTMLAttributes, type FC } from "react";

import { Icon } from "../../../../tailwind/components/next/icon";
import { joinClasses } from "../../../../tailwind/components/next/utils";

interface ProfileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  imageSrc?: string;
  isActive?: boolean;
  emoji?: string;
  profileName?: string;
  isLastDeployed?: boolean;
  isDeploying?: boolean;
}

export const ProfileButton: FC<ProfileButtonProps> = ({
  imageSrc,
  isActive,
  emoji,
  profileName,
  isLastDeployed,
  isDeploying,
  ...props
}) => {
  return (
    <button
      className="group relative size-12 overflow-hidden rounded-lg"
      title={profileName}
      {...props}
    >
      {imageSrc !== undefined && (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={imageSrc}
        />
      )}

      <span
        className={joinClasses([
          "absolute inset-0 z-1 rounded-lg transition-colors",
          isActive
            ? "border-2 border-neutral-strong"
            : "border border-stroke-weak group-hover:border-2 group-hover:border-neutral-strong",
        ])}
      />

      {isLastDeployed === true && (
        <span className="absolute left-1/2 top-0 z-2 flex h-4 w-5 -translate-x-1/2 items-center justify-center rounded-b-sm bg-black/70">
          {isDeploying === true ? (
            <Icon
              className="animate-spin text-white"
              path={mdiLoading}
              size="xs"
            />
          ) : (
            <Icon className="text-white" path={mdiPlay} size="xs" />
          )}
        </span>
      )}

      {emoji !== undefined && (
        <span className="absolute right-0 top-0 z-2 flex size-4 items-center justify-center rounded-bl-md bg-black/70 text-xs">
          {emoji}
        </span>
      )}
    </button>
  );
};
