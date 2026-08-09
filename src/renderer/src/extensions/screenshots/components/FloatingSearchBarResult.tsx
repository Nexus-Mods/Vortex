import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import type { IModResult } from "../util/searchMods";

interface IFloatingSearchBarResultProps {
  onClick: () => void;
  result: IModResult;
}

export default function FloatingSearchBarResult({
  onClick,
  result,
}: IFloatingSearchBarResultProps) {
  return (
    <div className="flex gap-2 overflow-hidden px-2 py-1 hover:bg-surface-mid" onClick={onClick}>
      <img
        className="aspect-mod max-h-16 w-24 rounded-sm"
        src={result.adult ? result.thumbnailBlurredUrl : result.thumbnailUrl}
      />

      <Typography
        appearance="strong"
        brand="primary"
        className="line-clamp-2"
        typographyType="body-md"
      >
        {result.name}
      </Typography>
    </div>
  );
}
