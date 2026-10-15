import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setUseModernLayout } from "@/actions/window";
import type { IState } from "@/types/IState";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { applyTheme, getTheme } from "@/util/theme";

/**
 * Dev-only switches, from a button in the corner: the layout and the light theme. Render
 * it in development only.
 */
export const DevToolsMenu = () => {
  const dispatch = useDispatch();
  const useModernLayout = useSelector((state: IState) => state.settings.window.useModernLayout);
  // The theme lives on <html>, not in state, so the switch keeps its own copy.
  const [lightTheme, setLightTheme] = useState(() => getTheme() === "light");

  return (
    <Popover className="fixed right-4 bottom-4 z-toast">
      <PopoverButton
        aria-label="Dev tools"
        brand="primary"
        data-testid="dev-tools-trigger"
        leftIcon="build"
        title="Dev tools"
      />

      <PopoverPanel anchor={{ gap: 4, to: "top end" }}>
        <PopoverPanelGroup>
          <PopoverPanelGroupItem label="Modern layout">
            <Switch
              aria-label="Modern layout"
              checked={useModernLayout}
              data-testid="dev-tools-modern-layout"
              onChange={(checked: boolean) => dispatch(setUseModernLayout(checked))}
            />
          </PopoverPanelGroupItem>

          <PopoverPanelGroupItem label="Light theme">
            <Switch
              aria-label="Light theme"
              checked={lightTheme}
              data-testid="dev-tools-light-theme"
              onChange={(checked: boolean) => {
                applyTheme(checked ? "light" : "dark");
                setLightTheme(checked);
              }}
            />
          </PopoverPanelGroupItem>
        </PopoverPanelGroup>
      </PopoverPanel>
    </Popover>
  );
};
