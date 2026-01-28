import React, { type PropsWithChildren } from "react";

import type { IMainPage } from "../../../types/IMainPage";

import { joinClasses } from "../../../tailwind/components/next/utils";
import startupSettings from "../../../util/startupSettings";
import { useWindowContext } from "../../../util/WindowContext";
import { Header } from "../components/Header";
import { Menu } from "../components/Menu";
import { Spine } from "../components/Spine";

export const ModernLayout = ({
  objects,
  customTitlebar,
  switchingProfile,
  setMenuLayer,
}: PropsWithChildren<{
  objects: IMainPage[];
  customTitlebar: boolean;
  switchingProfile: boolean;
  setMenuLayer: (ref: HTMLDivElement | null) => void;
}>) => {
  const { isFocused, isMenuOpen, isHidpi } = useWindowContext();

  return (
    <div
      className={joinClasses(
        [
          "flex h-full bg-surface-base",
          isHidpi ? "hidpi" : "lodpi",
          isFocused ? "window-focused" : "window-unfocused",
        ],
        {
          "window-frame": customTitlebar,
          "menu-open": isMenuOpen,
          "no-gpu-acceleration": startupSettings.disableGPU,
        },
      )}
      key="main"
    >
      {/*<div className="menu-layer" ref={setMenuLayer} />*/}

      <Spine />

      <div className="flex grow flex-col">
        <Header />

        <div className="flex h-full pr-3 pb-3">
          <Menu />

          <div className="grow rounded-xl bg-surface-low p-3">Content</div>
        </div>
      </div>
    </div>
  );
};
