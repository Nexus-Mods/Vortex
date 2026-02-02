import React, { type FC } from "react";

import { useSwitchingProfile } from "../../hooks";
import { ModernContentPane } from "../components/ContentPane";
import { Header } from "../components/Header";
import { Menu } from "../components/Menu";
import { Spine } from "../components/Spine";
import { SpineProvider } from "../components/SpineContext";
import { DialogLayer } from "./DialogLayer";
import { LayoutContainer } from "./LayoutContainer";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ToastContainer } from "./ToastContainer";
import { UIBlocker } from "./UIBlocker";

export const ModernLayout: FC = () => {
  const switchingProfile = useSwitchingProfile();

  return (
    <SpineProvider>
      <LayoutContainer className="flex h-full bg-surface-base">
        <Spine />

        <div className="flex grow flex-col">
          <Header />

          {switchingProfile ? (
            <ProfileSwitcher />
          ) : (
            <div className="flex h-full pr-3 pb-3">
              <Menu />

              <ModernContentPane />

              <DialogLayer />

              <ToastContainer />
            </div>
          )}
        </div>
      </LayoutContainer>

      <UIBlocker />
    </SpineProvider>
  );
};
