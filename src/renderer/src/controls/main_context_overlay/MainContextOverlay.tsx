// react-bootstrap 0.33's OverlayTrigger draws its overlay as a separate React root, which
// MainContext doesn't reach, so a component in a popover would read MainContext's app-wide
// fallback. Inside a dialog that fallback is wrong: a menu opened from the popover would open on
// the app's menu layer, behind the dialog. MainContextOverlayTrigger hands the overlay the
// trigger's own MainContext instead.
import classNames from "classnames";
import React, {
  cloneElement,
  type CSSProperties,
  forwardRef,
  isValidElement,
  type ReactElement,
  useContext,
} from "react";
import { OverlayTrigger } from "react-bootstrap";

import { MainContext } from "../../contexts/main_context/MainContext";
import type { IComponentContext } from "../../types/IComponentContext";

export interface IMainContextOverlayProps {
  /** The MainContext where the overlay's trigger is. */
  context: IComponentContext;
  /** The overlay to draw, such as a Popover. */
  overlay: ReactElement;
  /**
   * The overlay's id. OverlayTrigger reads it off this component to point the trigger's
   * `aria-describedby` at the overlay.
   */
  id?: string;
  /** Set by react-bootstrap while it shows the overlay; merged with the overlay's own. */
  className?: string;
  /** Set by react-bootstrap to position the overlay; merged with the overlay's own. */
  style?: CSSProperties;
}

/**
 * Draws `overlay` with `context` as its MainContext. react-bootstrap positions an overlay by
 * passing it props (placement, positionLeft, className, style and so on); those reach this
 * component and are passed on to `overlay`, with `className` and `style` merged into the
 * overlay's own as react-bootstrap merges them.
 */
export function MainContextOverlay({
  context,
  overlay,
  className,
  style,
  ...positioning
}: IMainContextOverlayProps): ReactElement {
  return (
    <MainContext.Provider value={context}>
      {cloneElement(overlay, {
        ...positioning,
        className: classNames(className, overlay.props.className),
        style: { ...overlay.props.style, ...style },
      })}
    </MainContext.Provider>
  );
}

/**
 * react-bootstrap's OverlayTrigger, with the overlay given the trigger's MainContext. Use it in
 * place of react-bootstrap's, so a menu opened from a popover in a dialog opens above the dialog.
 */
export const MainContextOverlayTrigger = forwardRef<
  OverlayTrigger,
  OverlayTrigger.OverlayTriggerProps
>(function MainContextOverlayTrigger({ overlay, ...props }, ref) {
  const context = useContext(MainContext);
  return (
    <OverlayTrigger
      {...props}
      ref={ref}
      overlay={
        isValidElement<{ id?: string }>(overlay) ? (
          <MainContextOverlay context={context} overlay={overlay} id={overlay.props.id} />
        ) : (
          overlay
        )
      }
    />
  );
});
