import React, { type FC } from "react";
import { useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import FlexLayout from "../../controls/FlexLayout";
import { useSwitchingProfile } from "../../hooks";
import { WindowControls } from "../WindowControls";
import { DialogLayer } from "./DialogLayer";
import { LayoutContainer } from "./LayoutContainer";
import { MainLayout } from "./MainLayout";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ToastContainer } from "./ToastContainer";
import { Toolbar } from "./Toolbar";
import { UIBlocker } from "./UIBlocker";

export const ClassicLayout: FC = () => {
  const customTitlebar = useSelector(
    (state: IState) => state.settings.window.customTitlebar,
  );
  const switchingProfile = useSwitchingProfile();

  return (
    <>
      <LayoutContainer>
        <FlexLayout id="main-window-content" type="column">
          <Toolbar />

          {customTitlebar ? <div className="dragbar" /> : null}

          {switchingProfile ? <ProfileSwitcher /> : <MainLayout />}
        </FlexLayout>

        <DialogLayer />

        <ToastContainer />

        {customTitlebar ? <WindowControls /> : null}
      </LayoutContainer>

      <UIBlocker />
    </>
  );
};
