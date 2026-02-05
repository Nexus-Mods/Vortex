import React, { type ButtonHTMLAttributes, type FC, useMemo } from "react";
import { pathToFileURL } from "url";

import type { IStarterInfo } from "../../../../util/StarterInfo";

import StarterInfo from "../../../../util/StarterInfo";

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  starter: IStarterInfo;
  isPrimary?: boolean;
  isValid?: boolean;
}

export const ToolButton: FC<ToolButtonProps> = ({
  starter,
  isPrimary = false,
  isValid = true,
  ...props
}) => {
  const imageSrc = useMemo(() => {
    try {
      const iconPath = StarterInfo.getIconPath(starter);
      if (iconPath) {
        return pathToFileURL(iconPath).href.replace("'", "%27");
      }
      return undefined;
    } catch {
      return undefined;
    }
  }, [starter]);

  return (
    <button
      className="hover-overlay relative size-8 shrink-0 rounded-sm border border-stroke-moderate before:z-1"
      title={isValid ? starter.name : `${starter.name} (Not configured)`}
      {...props}
    >
      {imageSrc ? (
        <img
          alt={starter.name}
          className={`absolute inset-0 size-full object-cover ${!isValid ? "opacity-40 grayscale" : ""}`}
          src={imageSrc}
        />
      ) : (
        <div
          className={`text-foreground-muted absolute inset-0 flex items-center justify-center bg-surface-high text-xs ${!isValid ? "opacity-40" : ""}`}
        >
          {starter.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
      )}

      <span className="absolute inset-0 z-1 rounded-sm border border-stroke-moderate" />

      {isPrimary && (
        <span className="bg-accent-primary absolute -top-0.5 -right-0.5 z-2 size-2 rounded-full" />
      )}
    </button>
  );
};
