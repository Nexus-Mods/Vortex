import React from "react";

import { Tooltip } from "@/ui/components/tooltip/Tooltip";

interface IVersionTextProps {
  /** The version or revision, as text. */
  version: string;
  /**
   * Whether buttons or an icon follow it: then it takes a fixed width, so theirs line up down
   * the column, truncating, its whole in a tooltip.
   */
  fixed?: boolean;
}

/** A Version cell's version, subdued; 40px wide when buttons or an icon follow it. */
export const VersionText = ({ version, fixed = false }: IVersionTextProps) =>
  fixed ? (
    <Tooltip content={version}>
      <span className="w-10 shrink-0 truncate text-translucent-subdued">{version}</span>
    </Tooltip>
  ) : (
    <span className="truncate text-translucent-subdued">{version}</span>
  );
