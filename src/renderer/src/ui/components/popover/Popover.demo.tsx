/**
 * Popover Demo Component
 * Demonstrates the Popover component, a settings-panel use case, and menus with
 * nested submenus — one row, and two adjacent ones to hover between
 */

import {
  mdiAccountCircle,
  mdiBroom,
  mdiCheckCircleOutline,
  mdiDeleteOutline,
  mdiFilterOutline,
  mdiHelpCircleOutline,
  mdiInformationOutline,
  mdiLogout,
  mdiPalette,
  mdiRefresh,
  mdiRocketLaunchOutline,
  mdiSortVariant,
  mdiStarOutline,
  mdiTune,
  mdiViewGrid,
  mdiViewList,
} from "@mdi/js";
import React, { useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Switch } from "@/ui/components/form/switch/Switch";
import { type IListboxOption } from "@/ui/components/listbox/ListboxOption";
import { Picker } from "@/ui/components/picker/Picker";
import { Typography } from "@/ui/components/typography/Typography";

import { Popover } from "./Popover";
import { PopoverButton } from "./PopoverButton";
import { PopoverMenu } from "./PopoverMenu";
import type { IMenuAction } from "./PopoverMenuItem";
import { PopoverPanel } from "./PopoverPanel";
import { PopoverPanelGroup } from "./PopoverPanelGroup";
import { PopoverPanelGroupItem } from "./PopoverPanelGroupItem";

const layoutOptions = [
  { label: "Grid", value: "grid", iconPath: mdiViewGrid },
  { label: "List", value: "list", iconPath: mdiViewList },
] satisfies IListboxOption<string>[];

const helpActions: IMenuAction[][] = [
  [
    { label: "Help centre", iconPath: mdiHelpCircleOutline, onClick: () => {} },
    { label: "About", iconPath: mdiInformationOutline, onClick: () => {} },
  ],
];

/**
 * The submenu row passes `dismiss` rather than `close` as its menu's `onSelect`:
 * choosing a help destination ends the interaction, so the account menu it was
 * opened from goes away with it.
 */
const accountActions: IMenuAction[][] = [
  [{ label: "View profile on web", iconPath: mdiAccountCircle, onClick: () => {} }],
  [
    { label: "Refresh user info", iconPath: mdiRefresh, onClick: () => {} },
    {
      label: "Help",
      iconPath: mdiHelpCircleOutline,
      panelRole: "menu",
      panel: ({ close, dismiss }) => (
        <PopoverMenu actions={helpActions} label="Help" onClose={close} onSelect={dismiss} />
      ),
    },
  ],
  [{ label: "Logout", iconPath: mdiLogout, onClick: () => {} }],
];

const sortRows: IMenuAction[][] = [
  [
    { label: "Name", onClick: () => {} },
    { label: "Date added", onClick: () => {} },
    { label: "Size on disk", onClick: () => {} },
  ],
];

const filterRows: IMenuAction[][] = [
  [
    { label: "Enabled only", onClick: () => {} },
    { label: "Disabled only", onClick: () => {} },
    { label: "Everything", onClick: () => {} },
  ],
];

/**
 * Two rows that each open a submenu, with a plain row under them — the shape the app
 * doesn't have anywhere yet, kept here so the pointer travelling between adjacent
 * submenus, and off them onto an ordinary row, stays exercised.
 */
const twoSubmenuActions: IMenuAction[][] = [
  [
    {
      label: "Sort by",
      iconPath: mdiSortVariant,
      panelRole: "menu",
      panel: ({ close, dismiss }) => (
        <PopoverMenu actions={sortRows} label="Sort by" onClose={close} onSelect={dismiss} />
      ),
    },
    {
      label: "Filter",
      iconPath: mdiFilterOutline,
      panelRole: "menu",
      panel: ({ close, dismiss }) => (
        <PopoverMenu actions={filterRows} label="Filter" onClose={close} onSelect={dismiss} />
      ),
    },
  ],
  [{ label: "Refresh", iconPath: mdiRefresh, onClick: () => {} }],
];

/**
 * One row per brand, which the toolbar leans on: an action collapsed off the bar into
 * the overflow keeps the emphasis it had as a button. `danger` is the one brand a row
 * takes further than the icon, colouring the whole row.
 */
const brandedActions: IMenuAction[][] = [
  [
    { label: "Deploy Mods", iconPath: mdiRocketLaunchOutline, brand: "primary", onClick: () => {} },
    { label: "Check for Updates", iconPath: mdiRefresh, brand: "info", onClick: () => {} },
    { label: "Verified", iconPath: mdiCheckCircleOutline, brand: "success", onClick: () => {} },
    { label: "Go Premium", iconPath: mdiStarOutline, brand: "premium", onClick: () => {} },
    { label: "Purge Mods", iconPath: mdiBroom, brand: "neutral", onClick: () => {} },
  ],
  [{ label: "Remove Mod", iconPath: mdiDeleteOutline, brand: "danger", onClick: () => {} }],
];

export const PopoverDemo = () => {
  const [layout, setLayout] = useState("grid");
  const [showHidden, setShowHidden] = useState(false);

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Popover
        </Typography>

        <Typography appearance="subdued">
          A floating panel of arbitrary interactive content built on Headless UI Popover. Unlike
          Dropdown (a menu of actions that closes on selection), a Popover holds controls — pickers,
          switches, buttons — and stays open until an outside click or Escape. Use PopoverButton
          (which forwards all Button props) as the trigger and PopoverPanel for the content.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Display options panel
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          A trigger button that opens a panel of settings, composed from PopoverPanelGroup rows. The
          panel stays open while you change the picker or toggle the switch. Change either and a
          reset group appears — because each group states its own separator, the rule above it
          arrives with it and the panel never ends on one.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Popover>
            <PopoverButton appearance="subdued" brand="neutral" leftIconPath={mdiTune} />

            <PopoverPanel className="nxm-popover-panel-controls">
              <PopoverPanelGroup>
                <PopoverPanelGroupItem label="Display as">
                  <Picker
                    button={{
                      leftIconPath: layout === "list" ? mdiViewList : mdiViewGrid,
                      size: "sm",
                    }}
                    options={layoutOptions}
                    value={layout}
                    onChange={setLayout}
                  />
                </PopoverPanelGroupItem>
              </PopoverPanelGroup>

              <PopoverPanelGroup>
                <PopoverPanelGroupItem label="Show hidden items">
                  <Switch
                    aria-label="Show hidden items"
                    checked={showHidden}
                    onChange={setShowHidden}
                  />
                </PopoverPanelGroupItem>
              </PopoverPanelGroup>

              {(layout !== "grid" || showHidden) && (
                <PopoverPanelGroup>
                  <PopoverPanelGroupItem className="justify-end">
                    <Button
                      appearance="subdued"
                      brand="primary"
                      type="button"
                      onClick={() => {
                        setLayout("grid");
                        setShowHidden(false);
                      }}
                    >
                      Reset to default
                    </Button>
                  </PopoverPanelGroupItem>
                </PopoverPanelGroup>
              )}
            </PopoverPanel>
          </Popover>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Menu with a nested submenu
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          A PopoverMenu of actions in groups, where one row opens a submenu beside it — the parent
          stays open behind it, which a Dropdown could not do. Arrow keys rove the whole menu across
          group rules, → opens the submenu, ← and Escape back out of it. Choosing a row in the
          submenu puts both away.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Popover>
            <PopoverButton appearance="subdued" brand="neutral" leftIconPath={mdiAccountCircle} />

            <PopoverPanel className="nxm-popover-panel-dropdown">
              {({ close }) => (
                <PopoverMenu actions={accountActions} label="Account" onSelect={close} />
              )}
            </PopoverPanel>
          </Popover>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Two submenus, side by side
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          For testing the pointer travelling between adjacent submenus. Hovering Sort by opens it;
          moving down to Filter should swap them, since leaving a row closes it just before the next
          one opens. Carrying on to Refresh should leave neither open, and sweeping straight past
          both should open nothing at all.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Popover>
            <PopoverButton appearance="subdued" brand="neutral" leftIconPath={mdiSortVariant} />

            <PopoverPanel className="nxm-popover-panel-dropdown">
              {({ close }) => (
                <PopoverMenu actions={twoSubmenuActions} label="View options" onSelect={close} />
              )}
            </PopoverPanel>
          </Popover>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Branded rows
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          A row takes the same brands a Button does, so an action reads the same whether it sits on
          a toolbar or in the overflow menu it collapsed into. Only the icon is tinted — the labels
          stay one even column of text to read down. neutral is the default, so it tints nothing.
          danger is the exception, colouring the whole row rather than just its icon — a destructive
          action being the one thing in a menu that should be hard to pick by accident.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Popover>
            <PopoverButton appearance="subdued" brand="neutral" leftIconPath={mdiPalette} />

            <PopoverPanel className="nxm-popover-panel-dropdown">
              {({ close }) => (
                <PopoverMenu actions={brandedActions} label="Branded rows" onSelect={close} />
              )}
            </PopoverPanel>
          </Popover>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Design Notes
        </Typography>

        <Typography appearance="subdued" as="ul" className="list-inside list-disc space-y-2">
          <li>PopoverButton forwards all Button props (brand, appearance, size, icons)</li>

          <li>PopoverPanel holds arbitrary interactive content and stays open until dismissed</li>

          <li>
            Closes on an outside click or Escape; Headless UI&apos;s anchor prop portals the panel
            out of any clipping ancestor and flips it into view
          </li>

          <li>
            Fill a panel of settings with PopoverPanelGroup rows, and give it
            nxm-popover-panel-controls; a panel of menu rows takes nxm-popover-panel-dropdown
          </li>

          <li>
            A menu row takes the same brand a Button does, tinting its icon rather than its label —
            except danger, which colours the whole row
          </li>

          <li>Use Dropdown instead when the items are one-shot actions rather than controls</li>

          <li>
            Use PopoverMenu for a menu whose rows open surfaces of their own; a Dropdown&apos;s Menu
            closes as soon as focus reaches one
          </li>
        </Typography>
      </div>
    </div>
  );
};
