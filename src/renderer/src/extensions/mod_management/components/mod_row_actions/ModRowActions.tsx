import { mdiPlus } from "@mdi/js";
import React, { memo, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { createSelector } from "reselect";

import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Switch } from "@/ui/components/form/switch/Switch";
import type { TableColumnWidth } from "@/ui/components/table/Table.types";
import { useTableRowEngaged } from "@/ui/components/table/TableRow.context";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { TitledTooltip } from "@/ui/components/tooltip/TitledTooltip";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { activeGameId } from "@/util/selectors";

import { INSTALLING_ACTIVITY } from "../../hooks/use_install_mods/useInstallMods.hook";
import { MOD_ROW_PINNING_ID } from "../../hooks/use_mod_actions/useModActions.hook";
import { MODS_TABLE_TOOLBARS } from "../../hooks/use_mods_table_analytics/useModsTableAnalytics.hook";
import { UNINSTALLING_ACTIVITY } from "../../hooks/use_uninstall_mods/useUninstallMods.hook";
import type { IModWithState } from "../../types/IModProps";

const storedMods = (state: IState) => state.persistent.mods?.[activeGameId(state)];

/** The archives the stored mods come from, worked out once each time the mods change. */
const storedArchiveIds = createSelector(
  storedMods,
  (stored) => new Set(Object.values(stored ?? {}).map((mod) => mod.archiveId)),
);

/** A mod being installed or uninstalled, which its row shows on the install button. */
type RowBusy = "installing" | "uninstalling";

/**
 * What a row's mod is under way with, if anything, as a plain value, so a row re-renders
 * only when its own answer changes, not on every write to the store.
 *
 * The list catches up with the store after a debounce, so a row can outlive what it shows:
 * an archive a mod in the store now comes from has just been installed, and a mod gone from
 * the store has just been uninstalled. Either stays loading until its new row takes over.
 */
const useRowBusy = (modId: string, modState: IModWithState["state"]): RowBusy | undefined =>
  useSelector((state: IState) => {
    const activity = state.session?.base?.activity;
    const justInstalled = modState === "downloaded" && storedArchiveIds(state).has(modId);
    if (
      modState === "installing" ||
      activity?.[INSTALLING_ACTIVITY]?.includes(modId) ||
      justInstalled
    ) {
      return "installing";
    }

    const stored = storedMods(state);
    const removed = modState === "installed" && stored !== undefined && !stored[modId];
    if (activity?.[UNINSTALLING_ACTIVITY]?.includes(modId) || removed) {
      return "uninstalling";
    }

    return undefined;
  });

// The switch and the menu's button; each pinned action adds a 28px button and an 8px gap.
const ACTIONS_WIDTH = 78;
export const PINNED_ACTION_WIDTH = 36;

/** The actions column's width, with room for this many pins. */
export const actionsWidth = (pinnedCount: number): TableColumnWidth =>
  `${ACTIONS_WIDTH + PINNED_ACTION_WIDTH * pinnedCount}px`;

interface IModRowActionsProps {
  /** The row's actions, the same array until they change. */
  actions: IToolbarAction[];
  /** Room for the pins, the switch and the menu, wider than the column is at rest. */
  width: TableColumnWidth;
  /** The mod the row is for, which the switch enables or disables. */
  modId: string;
  /** The switch's name. */
  label: string;
  /** Whether the switch is on, showing a change at once while it lands. */
  enabled: boolean;
  /** Whether a change is under way, which busies the switch. */
  isLoading: boolean;
  /** Enables or disables the mods, from the switch. */
  onSetEnabled: (modIds: string[], enabled: boolean) => void;
  /** Shows the switch alone while several rows are selected, so no action reads as for them all. */
  switchOnly: boolean;
  /** Installs the mod, for one only downloaded, whose button stands in for the switch. */
  onInstall?: (modId: string) => void;
  /** The mod's state, from which the row works out what's under way, as its own selector. */
  modState: IModWithState["state"];
  /** The install button's name, while there is one. */
  installLabel?: string;
}

/** Marks the switch, or the install button in its place, for focus to return to. */
const ROW_CONTROL = "data-row-control";

/**
 * A row's pinned actions, its switch, then its menu of every action. Against the cell's end,
 * as a group row's switch is, and as wide as the pins need so none collapse: at rest they
 * overhang the column, hidden, and the cell widens over them while the row is hovered.
 *
 * Only the switch renders until the row is first pointed at or focused, in the place the
 * toolbar puts it: the pins and the menu are hidden at rest, and a toolbar per row is costly
 * to mount as rows scroll in. Then the toolbar mounts and stays while the row does, so a menu
 * opened from it isn't torn down. Memoized, since rows re-render on each frame of a scroll.
 *
 * While several rows are selected, only the switch shows, in the same place, as at rest.
 *
 * A mod that's only downloaded has an Install button in the switch's place; one being installed
 * or uninstalled has it loading.
 */
export const ModRowActions = memo(
  ({
    actions,
    width,
    modId,
    label,
    enabled,
    isLoading,
    onSetEnabled,
    switchOnly,
    onInstall,
    installLabel,
    modState,
  }: IModRowActionsProps) => {
    const { t } = useTranslation(["common"]);
    const tracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.row);
    const busy = useRowBusy(modId, modState);
    const engaged = useTableRowEngaged();
    const restingRef = useRef<HTMLDivElement>(null);
    // the cell, while the resting switch has focus as the toolbar replaces it
    const refocusIn = useRef<HTMLElement | null>(null);

    useLayoutEffect(() => {
      if (engaged && refocusIn.current !== null) {
        refocusIn.current.querySelector<HTMLElement>(`[${ROW_CONTROL}]`)?.focus();
        refocusIn.current = null;
      }
    }, [engaged]);

    const installDescription = t(
      "Installs the mod into your game, where it can be enabled or disabled.",
    );

    const toggle =
      onInstall === undefined && busy === undefined ? (
        <Switch
          {...{ [ROW_CONTROL]: true }}
          aria-label={label}
          checked={enabled}
          isLoading={isLoading}
          onChange={(checked) => onSetEnabled([modId], checked)}
        />
      ) : (
        // On a wrapper, as a loading button is disabled and takes no hover. As wide as the switch
        // it stands in for, from its start, so it lines up with theirs.
        <Tooltip
          {...(busy === undefined
            ? { customContent: <TitledTooltip body={installDescription} title={t("Install")} /> }
            : { content: busy === "installing" ? t("Installing…") : t("Uninstalling…") })}
        >
          <span className="flex w-8 shrink-0">
            <Button
              {...{ [ROW_CONTROL]: true }}
              // a step lighter while loading, so it drops its border
              appearance={busy === undefined ? "subdued" : "weak"}
              aria-description={busy === undefined ? installDescription : undefined}
              aria-label={installLabel}
              brand="primary"
              isLoading={isLoading || busy !== undefined}
              leftIconPath={mdiPlus}
              size="sm"
              onClick={() => onInstall?.(modId)}
            />
          </span>
        </Tooltip>
      );

    if (!engaged || switchOnly) {
      return (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end gap-x-2"
          ref={restingRef}
          style={{ width }}
          onFocus={() => {
            if (!engaged) {
              refocusIn.current = restingRef.current?.parentElement ?? null;
            }
          }}
        >
          {toggle}

          <span aria-hidden className="w-7 shrink-0" />
        </div>
      );
    }

    return (
      <Toolbar
        className="absolute inset-y-0 right-0 justify-end"
        pinningId={MOD_ROW_PINNING_ID}
        pinTarget="row"
        style={{ width }}
        tracking={tracking}
      >
        <ToolbarGroup actions={actions} beforeOverflow={toggle} />
      </Toolbar>
    );
  },
);
