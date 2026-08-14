import { mdiTagRemove } from "@mdi/js";
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

import type { GameMediaModTag } from "../util/mediaTypes";

interface IModTagsIndicatorProps {
  x: number;
  y: number;
  mod?: GameMediaModTag;
}

export default function ModTagIndicator({ x, y, mod }: IModTagsIndicatorProps) {
  const baseClasses = ["bg-primary", "size-4", "rounded-full", "border-2", "border-white"];
  if (mod) baseClasses.push("bg-primary");
  else baseClasses.push("bg-info-moderate");

  const customContent = mod ? (
    <div className="flex items-center gap-2 p-2">
      {!!mod.thumbnail && <img className="aspect-mod w-24 rounded-sm" src={mod.thumbnail} />}

      <div className="w-48">
        <Typography
          brand="neutral"
          className="line-clamp-2"
          title={mod.name}
          typographyType="body-sm"
        >
          {mod.comment ? mod.comment : <a href={mod.url}>{mod.name}</a>}
        </Typography>

        {!!mod.comment && (
          <Typography appearance="subdued" className="mt-1 line-clamp-2" typographyType="body-xs">
            <a href={mod.url}>{mod.name}</a>
          </Typography>
        )}
      </div>

      <Button
        appearance="subdued"
        brand="neutral"
        leftIconPath={mdiTagRemove}
        size="sm"
        title="Remove"
      />
    </div>
  ) : null;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: "translate(-50%,-100%)",
      }}
    >
      <Tooltip interactive customContent={customContent} disabled={!mod} placement="bottom">
        <div className={baseClasses.join(" ")} />
      </Tooltip>
    </div>
  );
}
