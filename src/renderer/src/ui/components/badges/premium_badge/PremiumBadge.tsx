import { mdiDiamondStone } from "@mdi/js";
import React from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export const PremiumBadge = ({ className }: { className?: string }) => (
  <span
    className={joinClasses([
      "flex size-5 items-center justify-center rounded-sm bg-premium-moderate text-neutral-strong",
      className,
    ])}
  >
    <Icon path={mdiDiamondStone} size="sm" />
  </span>
);
