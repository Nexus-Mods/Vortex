import React, { type FC, useEffect } from "react";

import { useSwitchingProfile } from "../../hooks";
import { watchScrollActivity } from "../../ui/utils/scroll_activity/scrollActivity";
import { ModernContentPane } from "../components/ContentPane";
import { GameArt } from "../components/game_art/GameArt";
import { Header } from "../components/Header/Header";
import { Spine } from "../components/Spine/Spine";
import { SpineProvider } from "../components/Spine/SpineContext";
import { DialogLayer } from "./DialogLayer";
import { LayoutContainer } from "./LayoutContainer";
import { Menu } from "./menu/Menu";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ToastContainer } from "./ToastContainer";
import { UIBlocker } from "./UIBlocker";

export const ModernLayout: FC<React.PropsWithChildren<unknown>> = () => {
  const switchingProfile = useSwitchingProfile();

  useEffect(() => watchScrollActivity(document), []);

  return (
    <SpineProvider>
      <LayoutContainer className="relative isolate flex h-full overflow-hidden bg-surface-base">
        <GameArt />

        <Spine />

        <div className="flex min-w-0 grow flex-col">
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
