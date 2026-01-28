import * as React from "react";

import type { IMainPage } from "../../../types/IMainPage";

import startupSettings from "../../../util/startupSettings";
import { useWindowContext } from "../../../util/WindowContext";

export interface IModernLayoutProps {
  objects: IMainPage[];
  customTitlebar: boolean;
  switchingProfile: boolean;
  setMenuLayer: (ref: HTMLDivElement | null) => void;
}

export const ModernLayout: React.FC<IModernLayoutProps> = ({
  objects,
  customTitlebar,
  switchingProfile,
  setMenuLayer,
}) => {
  // We sill need to inject the old classes for compatibility with existing extensions
  const { isFocused, isMenuOpen, isHidpi } = useWindowContext();

  const classes: string[] = [];
  classes.push(isHidpi ? "hidpi" : "lodpi");
  classes.push(isFocused ? "window-focused" : "window-unfocused");
  if (customTitlebar) {
    classes.push("window-frame");
  }
  if (isMenuOpen) {
    classes.push("menu-open");
  }
  if (startupSettings.disableGPU) {
    classes.push("no-gpu-acceleration");
  }

  return (
    <div className={classes.join(" ")} key="main">
      <div className="menu-layer" ref={setMenuLayer} />

      <div>Modern Layout - Work in Progress</div>
    </div>
  );
};
