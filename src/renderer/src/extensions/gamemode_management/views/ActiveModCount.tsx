import type { TFunction } from "i18next";
import * as React from "react";

import { Icon as UiIcon } from "@/ui/components/icon/Icon";
import { nxmCollections } from "@/ui/icon-paths";

export interface IActiveModCountProps {
  t: TFunction;
  count?: number;
  compact?: boolean;
}

function ActiveModCount(props: IActiveModCountProps): JSX.Element | null {
  const { t, compact, count } = props;

  if (count === undefined) {
    return null;
  }

  const label = t("{{ count }} active mod", { count });

  const icon = <UiIcon path={nxmCollections} size="sm" />;
  return compact ? (
    <div className="flex items-center gap-x-1 text-sm" title={label}>
      {icon}

      <span>{count}</span>
    </div>
  ) : (
    <div className="active-mods flex items-center">
      {icon}

      <span>{label}</span>
    </div>
  );
}

export default ActiveModCount;
