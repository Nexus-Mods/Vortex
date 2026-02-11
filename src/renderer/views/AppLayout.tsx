import React, { type FC, Suspense } from "react";
import { Button as ReactButton } from "react-bootstrap";
import { addStyle } from "react-bootstrap/lib/utils/bootstrapUtils";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import { setUseModernLayout } from "../../actions/window";
import { Button } from "../../tailwind/components/next/button";
import { MutexProvider } from "../../util/MutexContext";
import {
  MainProvider,
  MenuLayerProvider,
  PagesProvider,
  WindowProvider,
} from "../contexts";
import Spinner from "../controls/Spinner";
import { ClassicLayout, ModernLayout } from "./layout";

addStyle(ReactButton, "secondary");
addStyle(ReactButton, "ad");
addStyle(ReactButton, "ghost");
addStyle(ReactButton, "link");
addStyle(ReactButton, "inverted");

const LayoutSwitcher = () => {
  const dispatch = useDispatch();
  const useModernLayout = useSelector(
    (state: IState) => state.settings.window.useModernLayout,
  );

  return (
    <Button
      buttonType="primary"
      className="fixed right-4 bottom-4 z-toast"
      size="sm"
      onClick={() => dispatch(setUseModernLayout(!useModernLayout))}
    >
      {useModernLayout ? "Switch to Classic" : "Switch to Modern"}
    </Button>
  );
};

export interface IBaseProps {
  className?: string;
}

export const AppLayout: FC<IBaseProps> = () => {
  const useModernLayout = useSelector(
    (state: IState) => state.settings.window.useModernLayout,
  );

  return (
    <Suspense fallback={<Spinner className="suspense-spinner" />}>
      <WindowProvider>
        <MenuLayerProvider>
          <MainProvider>
            <PagesProvider>
              <MutexProvider>
                {useModernLayout ? <ModernLayout /> : <ClassicLayout />}
              </MutexProvider>

              <LayoutSwitcher />
            </PagesProvider>
          </MainProvider>
        </MenuLayerProvider>
      </WindowProvider>
    </Suspense>
  );
};
