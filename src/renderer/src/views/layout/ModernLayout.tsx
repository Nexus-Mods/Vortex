import React, { type FC } from "react";

import { useSwitchingProfile } from "../../hooks";
import { ModernContentPane } from "../components/ContentPane";
import { Header } from "../components/Header";
import { Menu } from "../components/Menu";
import { Spine } from "../components/Spine";
import { SpineProvider } from "../components/Spine/SpineContext";
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

          <div className="flex min-h-0 grow">
            {switchingProfile ? (
              <ProfileSwitcher />
            ) : (
              <>
                <Menu />

                <ModernContentPane />
              </>
            )}

            <DialogLayer />

            <ToastContainer />
          </div>
        </div>
      </LayoutContainer>

      <UIBlocker />
    </SpineProvider>
  );
};
