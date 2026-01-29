import React, { type PropsWithChildren } from "react";

import type { IMainPage } from "../../../types/IMainPage";

import { joinClasses } from "../../../tailwind/components/next/utils";
import startupSettings from "../../../util/startupSettings";
import { useSwitchingProfile } from "../../../util/useSwitchingProfile";
import { useWindowContext } from "../../../util/WindowContext";
import { ModernContentPane } from "../components/ContentPane";
import { Header } from "../components/Header";
import { Menu } from "../components/Menu";
import { Spine } from "../components/Spine";
import { SpineProvider } from "../components/SpineContext";
import { DialogLayer } from "./DialogLayer";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ToastContainer } from "./ToastContainer";
import { UIBlocker } from "./UIBlocker";

export const ModernLayout = ({
  objects,
  customTitlebar,
  setMenuLayer,
}: PropsWithChildren<{
  objects: IMainPage[];
  customTitlebar: boolean;
  setMenuLayer: (ref: HTMLDivElement | null) => void;
}>) => {
  const { isFocused, menuLayerOpen, isHidpi } = useWindowContext();

  const switchingProfile = useSwitchingProfile();

  return (
    <SpineProvider>
      <div
        className={joinClasses(
          [
            "flex h-full bg-surface-base",
            isHidpi ? "hidpi" : "lodpi",
            isFocused ? "window-focused" : "window-unfocused",
          ],
          {
            "window-frame": customTitlebar,
            "menu-open": menuLayerOpen,
            "no-gpu-acceleration": startupSettings.disableGPU,
          },
        )}
        key="main"
      >
        <div className="menu-layer" ref={setMenuLayer} />

        <Spine />

        <div className="flex grow flex-col">
          <Header />

          {switchingProfile ? (
            <ProfileSwitcher />
          ) : (
            <div className="flex h-full pr-3 pb-3">
              <Menu objects={objects} />

              <ModernContentPane objects={objects} />

              <DialogLayer />

              <ToastContainer />
            </div>
          )}
        </div>
      </div>

      <UIBlocker />
    </SpineProvider>
  );
};
