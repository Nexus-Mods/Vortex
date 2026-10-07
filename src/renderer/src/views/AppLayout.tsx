import React, { type FC, Suspense } from "react";
import { Button as ReactButton } from "react-bootstrap";
import { addStyle } from "react-bootstrap/lib/utils/bootstrapUtils";
import { useSelector } from "react-redux";

import { MainProvider, MenuLayerProvider, PagesProvider, WindowProvider } from "../contexts";
import Spinner from "../controls/Spinner";
import { ZoomHotkeyIndicator } from "../extensions/settings_interface/components/ZoomHotkeyIndicator";
import type { IState } from "../types/IState";
import { MutexProvider } from "../util/MutexContext";
import { DevToolsMenu } from "./components/dev_tools/DevToolsMenu";
import { ClassicLayout, ModernLayout } from "./layout";

addStyle(ReactButton, "secondary");
addStyle(ReactButton, "ad");
addStyle(ReactButton, "ghost");
addStyle(ReactButton, "link");
addStyle(ReactButton, "inverted");

export interface IBaseProps {
  className?: string;
}

export const AppLayout: FC<React.PropsWithChildren<IBaseProps>> = () => {
  const useModernLayout = useSelector((state: IState) => state.settings.window.useModernLayout);

  return (
    <Suspense fallback={<Spinner className="suspense-spinner" />}>
      <WindowProvider>
        <MenuLayerProvider>
          <MainProvider>
            <PagesProvider>
              <MutexProvider>
                {useModernLayout ? <ModernLayout /> : <ClassicLayout />}
              </MutexProvider>

              <ZoomHotkeyIndicator />

              {process.env.NODE_ENV === "development" && <DevToolsMenu />}
            </PagesProvider>
          </MainProvider>
        </MenuLayerProvider>
      </WindowProvider>
    </Suspense>
  );
};
