import { mdiDelete } from "@mdi/js";
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

import type { ModMediaTag } from "../util/mediaTypes";

interface IModTagsIndicatorProps {
  x: number;
  y: number;
  mod?: ModMediaTag;
}

export default function ModTagIndicator({ x, y, mod }: IModTagsIndicatorProps) {
  const baseClasses = ["bg-primary", "size-4", "rounded-full", "border-2", "border-white"];
  if (mod) baseClasses.push("bg-primary");
  else baseClasses.push("bg-info-moderate");

  const customContent = mod ? (
    <div className="flex flex-col gap-2 p-2">
      {!!mod.thumbnail && <img className="aspect-mod w-24 rounded-sm" src={mod.thumbnail} />}

      <div className="w-48">
        <Typography brand="neutral" className="line-clamp-2" typographyType="body-md">
          <a href={mod.url}>{mod.name}</a>
        </Typography>

        {!!mod.comment && (
          <Typography appearance="subdued" className="mt-1 line-clamp-2" typographyType="body-xs">
            {mod.comment}
          </Typography>
        )}
      </div>

      <Button appearance="subdued" brand="neutral" leftIconPath={mdiDelete} size="sm" />
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
