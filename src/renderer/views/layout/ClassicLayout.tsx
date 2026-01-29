import * as React from "react";

import type { IMainPage } from "../../../types/IMainPage";

import startupSettings from "../../../util/startupSettings";
import { useSwitchingProfile } from "../../../util/useSwitchingProfile";
import { useWindowContext } from "../../../util/WindowContext";
import FlexLayout from "../../controls/FlexLayout";
import { WindowControls } from "../WindowControls";
import { DialogLayer } from "./DialogLayer";
import { MainLayout } from "./MainLayout";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ToastContainer } from "./ToastContainer";
import { Toolbar } from "./Toolbar";
import { UIBlocker } from "./UIBlocker";

export interface IClassicLayoutProps {
  objects: IMainPage[];
  customTitlebar: boolean;
  setMenuLayer: (ref: HTMLDivElement | null) => void;
}

export const ClassicLayout: React.FC<IClassicLayoutProps> = ({
  objects,
  customTitlebar,
  setMenuLayer,
}) => {
  const { isFocused, menuLayerOpen, isHidpi } = useWindowContext();
  const switchingProfile = useSwitchingProfile();

  const classes: string[] = [];
  classes.push(isHidpi ? "hidpi" : "lodpi");
  classes.push(isFocused ? "window-focused" : "window-unfocused");
  if (customTitlebar) {
    classes.push("window-frame");
  }
  if (menuLayerOpen) {
    classes.push("menu-open");
  }
  if (startupSettings.disableGPU) {
    classes.push("no-gpu-acceleration");
  }

  return (
    <>
      <div className={classes.join(" ")} key="main">
        <div className="menu-layer" ref={setMenuLayer} />

        <FlexLayout id="main-window-content" type="column">
          <Toolbar />

          {customTitlebar ? <div className="dragbar" /> : null}

          {switchingProfile ? (
            <ProfileSwitcher />
          ) : (
            <MainLayout objects={objects} />
          )}
        </FlexLayout>

        <DialogLayer />

        <ToastContainer />

        {customTitlebar ? <WindowControls /> : null}
      </div>

      <UIBlocker />
    </>
  );
};
