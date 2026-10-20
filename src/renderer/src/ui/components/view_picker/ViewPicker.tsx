import { mdiPlus } from "@mdi/js";
import React, { Fragment, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { joinClasses } from "@/ui/utils/joinClasses";

import { ViewButton } from "./ViewButton";

export interface IViewPickerView {
  /** Its stable id, never its label. */
  id: string;
  /** Its name, as shown. */
  label: string;
  /** For a view of the user's own: what can be done with it, in groups, on its menu. */
  actions?: IMenuAction[][];
}

interface IViewPickerProps {
  /** Extra classes for the picker. */
  className?: string;
  /** Names the picker, for screen readers. */
  label: string;
  /** The open view's id. */
  selectedView: string;
  /** The built-in views, then the user's own. */
  views: IViewPickerView[];
  /** Opens a view, by id. */
  onSelectView: (viewId: string) => void;
  /** Starts making a view of the user's own, from the "+" at the end; without it, no "+". */
  onAddView?: () => void;
}

/** The picker's own views, in order. */
const ownViews = (picker: HTMLElement) =>
  [...picker.querySelectorAll<HTMLElement>(".nxm-view-button")].filter(
    (view) => view.closest(".nxm-view-picker") === picker,
  );

/**
 * The views of a list people can switch between and add their own to: the built-in views,
 * then the user's own after a divider, each with a menu, then a "+" to make another. Views
 * aren't tabs, with no panels of their own, so they're toggle buttons.
 *
 * The views are one Tab stop, the open one or else the first; the arrow keys move focus
 * between them, wrapping, Home and End go to either end, and Space or Enter opens one. The
 * "+" keeps its own Tab stop.
 */
export const ViewPicker = ({
  className,
  label,
  selectedView,
  views,
  onSelectView,
  onAddView,
}: IViewPickerProps) => {
  const { t } = useTranslation();
  const tabStop = views.some((view) => view.id === selectedView) ? selectedView : views[0]?.id;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = ownViews(event.currentTarget);
    const current = buttons.findIndex((button) => button.contains(event.target as Node));

    if (current < 0) {
      return;
    }

    const next: Partial<Record<string, number>> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: buttons.length - 1,
    };
    const index = next[event.key];

    if (index === undefined) {
      return;
    }

    event.preventDefault();
    buttons[(index + buttons.length) % buttons.length].focus();
  };

  return (
    <div
      aria-label={label}
      className={joinClasses(["nxm-view-picker", className])}
      role="group"
      onKeyDown={onKeyDown}
    >
      {views.map((view, index) => (
        <Fragment key={view.id}>
          {!!view.actions && index > 0 && !views[index - 1].actions && (
            <span aria-hidden className="nxm-view-picker-divider" />
          )}

          <ViewButton
            isPressed={view.id === selectedView}
            menu={
              view.actions && {
                actions: view.actions,
                label: t("{{name}} view actions", { name: view.label }),
              }
            }
            tabIndex={view.id === tabStop ? 0 : -1}
            onClick={() => onSelectView(view.id)}
          >
            {view.label}
          </ViewButton>
        </Fragment>
      ))}

      {!!onAddView && (
        <Tooltip content={t("Add view")}>
          <Button
            appearance="weak"
            aria-label={t("Add view")}
            brand="neutral"
            leftIconPath={mdiPlus}
            onClick={onAddView}
          />
        </Tooltip>
      )}
    </div>
  );
};
