/**
 * Popover Demo Component
 * Demonstrates the Popover component and a settings-panel use case
 */

import { mdiTune, mdiViewGrid, mdiViewList } from "@mdi/js";
import React, { useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Switch } from "@/ui/components/form/switch/Switch";
import { type IListboxOption } from "@/ui/components/listbox/ListboxOption";
import { Picker } from "@/ui/components/picker/Picker";
import { Typography } from "@/ui/components/typography/Typography";

import { Popover } from "./Popover";
import { PopoverButton } from "./PopoverButton";
import { PopoverPanel } from "./PopoverPanel";

const layoutOptions = [
  { label: "Grid", value: "grid", iconPath: mdiViewGrid },
  { label: "List", value: "list", iconPath: mdiViewList },
] satisfies IListboxOption<string>[];

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
          A trigger button that opens a panel of settings. The panel stays open while you change the
          picker or toggle the switch.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Popover>
            <PopoverButton appearance="subdued" brand="neutral" leftIconPath={mdiTune} size="sm" />

            <PopoverPanel className="right-auto left-0">
              <div className="flex min-h-12 items-center justify-between gap-x-6 border-b border-stroke-weak px-4">
                <Typography appearance="subdued" typographyType="body-sm">
                  Display as
                </Typography>

                <Picker
                  button={{
                    leftIconPath: layout === "list" ? mdiViewList : mdiViewGrid,
                    size: "xs",
                  }}
                  options={layoutOptions}
                  value={layout}
                  onChange={setLayout}
                />
              </div>

              <div className="flex min-h-12 items-center justify-between gap-x-6 border-b border-stroke-weak px-4">
                <Typography appearance="subdued" typographyType="body-sm">
                  Show hidden items
                </Typography>

                <Switch
                  aria-label="Show hidden items"
                  checked={showHidden}
                  onChange={(e) => setShowHidden(e.target.checked)}
                />
              </div>

              <div className="flex min-h-12 items-center justify-end px-4">
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
              </div>
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

          <li>Closes on an outside click or Escape; positioned manually until Headless UI v2</li>

          <li>Use Dropdown instead when the items are one-shot actions rather than controls</li>
        </Typography>
      </div>
    </div>
  );
};
