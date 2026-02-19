import React, { type ReactNode, type FC, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import type { IState } from "../../types/IState";

import { useMenuLayerContext, useWindowContext } from "../../contexts";
import { joinClasses } from "../../ui/utils/joinClasses";
import startupSettings from "../../util/startupSettings";

export interface ILayoutContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Provides the main container for the layout, applying necessary classes and refs.
 * For both layouts.
 */
export const LayoutContainer: FC<ILayoutContainerProps> = ({
  children,
  className,
}) => {
  const { isFocused, isHidpi } = useWindowContext();
  const { menuLayerOpen, setMenuLayerRef } = useMenuLayerContext();

  const { customTitlebar, useModernLayout } = useSelector(
    (state: IState) => state.settings.window,
  );

  // Add custom titlebar class on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    if (customTitlebar) {
      document.body.classList.add("custom-titlebar-body");
    }
  }, [customTitlebar]);

  return (
    <div
      className={joinClasses([className], {
        hidpi: isHidpi,
        lodpi: !isHidpi,
        "window-focused": isFocused,
        "window-unfocused": !isFocused,
        "window-frame": customTitlebar,
        "menu-open": menuLayerOpen,
        "modern-layout": useModernLayout,
        "no-gpu-acceleration": startupSettings.disableGPU,
      })}
      key="main"
    >
      <div className="menu-layer" ref={setMenuLayerRef} />

      {children}
    </div>
  );
};
