// react-bootstrap 0.33's OverlayTrigger draws its overlay as a separate React root, which
// MainContext doesn't reach, so a component in a popover would read MainContext's app-wide
// fallback. Inside a dialog that fallback is wrong: a menu opened from the popover would open on
// the app's menu layer, behind the dialog. Wrapping the overlay in this hands it the trigger's
// own MainContext instead.
import React, { cloneElement, type ReactElement } from "react";

import { MainContext } from "../../contexts/main_context/MainContext";
import type { IComponentContext } from "../../types/IComponentContext";

export interface IMainContextOverlayProps {
  /** The MainContext where the overlay's trigger is. */
  context: IComponentContext;
  /** The overlay to draw, such as a Popover. */
  overlay: ReactElement;
}

/**
 * Draws `overlay` with `context` as its MainContext. react-bootstrap positions an overlay by
 * passing it props (placement, positionLeft, and so on); those reach this component and are
 * passed on to `overlay`.
 */
export function MainContextOverlay({
  context,
  overlay,
  ...positioning
}: IMainContextOverlayProps): ReactElement {
  return (
    <MainContext.Provider value={context}>
      {cloneElement(overlay, positioning)}
    </MainContext.Provider>
  );
}
