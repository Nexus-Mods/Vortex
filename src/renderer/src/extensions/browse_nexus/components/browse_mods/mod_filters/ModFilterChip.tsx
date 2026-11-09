import React from "react";
import { useTranslation } from "react-i18next";

import { SplitButton, SplitButtonAction } from "@/ui/components/split_button/SplitButton";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import type { IAdultContentAccess, IModFilter } from "../../../util/mod_filters/modFilter.types";
import type { IModFilters } from "../../../util/mod_views/modViews";
import { ModFilterMenu } from "./ModFilterMenu";

interface IModFilterChipProps extends IAdultContentAccess {
  /** The filter it's for. */
  filter: IModFilter;
  /** Which mods the open view shows, as the user sees them. */
  filters: IModFilters;
  /** Changes the filter. */
  onChange: (change: Partial<IModFilters>) => void;
  /** Takes the filter off, so it no longer narrows the mods. */
  onRemove: () => void;
}

/**
 * A filter's chip in the bar: the choice on, in brief, opening its choices, with a button to take
 * it off. While the filter's locked, as on the website, it stays to say so, disabled, in a group
 * that takes focus in its place, its tooltip saying why on hover or focus.
 */
export const ModFilterChip = ({ filter, onRemove, ...props }: IModFilterChipProps) => {
  const { t } = useTranslation();
  const choice = filter.choices(t).find(({ value }) => value === props.filters[filter.key]);
  const locked = filter.lockedReason?.(t, props);

  const chip = (
    <SplitButton
      action={<SplitButtonAction icon="close" label={filter.removeLabel(t)} onClick={onRemove} />}
      appearance="subdued"
      brand="neutral"
      className={locked ? "pointer-events-none" : undefined}
      isDisabled={!!locked}
      leftIcon={filter.icon}
      panel={({ close }) => <ModFilterMenu {...props} filter={filter} onSelect={close} />}
      panelRole="menu"
      size="sm"
    >
      {choice?.short}
    </SplitButton>
  );

  if (!locked) {
    return chip;
  }

  return (
    <Tooltip content={locked}>
      <span
        aria-label={filter.label(t)}
        className="inline-flex rounded-sm focus-ring"
        role="group"
        tabIndex={0}
      >
        {chip}
      </span>
    </Tooltip>
  );
};
