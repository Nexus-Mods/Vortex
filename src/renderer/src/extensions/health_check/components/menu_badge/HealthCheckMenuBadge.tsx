import React from "react";
import { useSelector } from "react-redux";

import { useWindowContext } from "@/contexts";
import type { IState } from "@/types/IState";
import { joinClasses } from "@/ui/utils/joinClasses";

import { selectListedEntries } from "../../utils/shared/listedEntries";
import { type Severity, severityStyleMap } from "../../utils/shared/severityStyles";

const SEVERITY_RANK: Record<Severity, number> = { suggestion: 0, warning: 1, error: 2 };

const highestActiveSeverity = (state: IState): Severity | undefined => {
  let worst: Severity | undefined;

  for (const { entry, hidden } of selectListedEntries(state)) {
    if (hidden) {
      continue;
    }

    if (worst === undefined || SEVERITY_RANK[entry.severity] > SEVERITY_RANK[worst]) {
      worst = entry.severity;
    }
  }

  return worst;
};

export const HealthCheckMenuBadge = () => {
  const { menuIsCollapsed } = useWindowContext();
  const severity = useSelector(highestActiveSeverity);

  if (!severity) {
    return null;
  }

  return (
    <span
      className={joinClasses(
        ["size-1.5 shrink-0 rounded-full", severityStyleMap[severity].backgroundClassName],
        { "absolute top-1.5 right-1.5": menuIsCollapsed },
      )}
    />
  );
};
