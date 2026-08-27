import {
  arrow,
  autoUpdate,
  flip,
  FloatingArrow,
  FloatingPortal,
  limitShift,
  offset,
  type OpenChangeReason,
  type Placement,
  safePolygon,
  shift,
  size,
  useDelayGroup,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  useTransitionStyles,
} from "@floating-ui/react";
import React, {
  cloneElement,
  isValidElement,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useRef,
  useState,
} from "react";

import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

/** Portalling here is what lets tooltips escape `overflow: hidden` ancestors. */
const OVERLAY_HOST_ID = "overlays";

const TRIGGER_GAP = 8;
/** Gap kept between the tooltip and the window edges. */
const COLLISION_PADDING = 8;
/** Floor for the reported height, so a cramped corner scrolls rather than collapses. */
const MIN_AVAILABLE_HEIGHT = 96;
const ARROW_HEIGHT = 8;
const ARROW_WIDTH = 12;
/** Keeps the arrow off the tooltip's rounded corners. */
const ARROW_PADDING = 8;
/** FloatingArrow doubles and clips this, so 1 renders as a 1px edge. */
const ARROW_STROKE_WIDTH = 1;
const TRANSITION_MS = 30;

export type ITooltipPlacement = Placement;

export type ITooltipDelay = number | { close?: number; open?: number };

interface ITooltipBaseProps {
  /** The trigger. Must forward a ref to a DOM node — wrap bare text in a `span`. */
  children: ReactElement;
  className?: string;
  /** Hover delays in ms. A single number sets both open and close. */
  delay?: ITooltipDelay;
  /** Renders the trigger untouched, with no tooltip attached. */
  disabled?: boolean;
  /** Lets the pointer travel into the tooltip and use its content. */
  interactive?: boolean;
  /** Preferred side. Flips and slides automatically when it would overflow. */
  placement?: ITooltipPlacement;
  showArrow?: boolean;
}

export type ITooltipProps = ITooltipBaseProps &
  XOr<{ content: string }, { customContent: ReactNode }>;

/**
 * Collision-aware tooltip: flips, slides and clamps against the window, and
 * renders into the overlay host so nothing clips it.
 */
export const Tooltip = ({
  children,
  className,
  content,
  customContent,
  delay = { close: 50, open: 250 },
  disabled = false,
  interactive = false,
  placement = "top",
  showArrow = true,
}: ITooltipProps) => {
  const [open, setOpen] = useState(false);

  // Disabling unregisters the trigger as Floating UI's reference, so a tooltip left open
  // across it would come back unplaced — in the window's corner — once re-enabled.
  const [wasDisabled, setWasDisabled] = useState(disabled);

  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);

    if (disabled) {
      setOpen(false);
    }
  }

  const arrowRef = useRef<SVGSVGElement>(null);
  const referenceRef = useRef<HTMLElement | null>(null);

  // Headless UI refocuses its own trigger when its panel closes and the browser calls that
  // :focus-visible, so only its data-focus — React Aria's modality tracking — means keyboard.
  const handleOpenChange = (next: boolean, _event?: Event, reason?: OpenChangeReason) => {
    const element = referenceRef.current;

    if (
      next &&
      reason === "focus" &&
      element?.hasAttribute("data-headlessui-state") === true &&
      !element.hasAttribute("data-focus")
    ) {
      return;
    }

    setOpen(next);
  };

  const { context, floatingStyles, refs } = useFloating({
    middleware: [
      offset(showArrow ? TRIGGER_GAP + ARROW_HEIGHT : TRIGGER_GAP),
      // Swap sides rather than overflow. crossAxis off so shift handles the other axis,
      // or a trigger near an edge flips to an unasked-for side when a nudge would do.
      flip({ crossAxis: false, fallbackAxisSideDirection: "start", padding: COLLISION_PADDING }),
      // Slide along the edge; limitShift stops it detaching from the trigger.
      shift({ limiter: limitShift(), padding: COLLISION_PADDING }),
      size({
        // Annotated because pnpm keeps @floating-ui/dom out of reach here, so the
        // re-exported middleware options widen to `any`.
        apply({
          availableHeight,
          availableWidth,
          elements,
        }: {
          availableHeight: number;
          availableWidth: number;
          elements: { floating: HTMLElement };
        }) {
          // Hard limits only. The design cap is `max-width` on .nxm-tooltip
          // inside this element, so the narrower of the two wins on its own.
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(availableHeight, MIN_AVAILABLE_HEIGHT)}px`,
            maxWidth: `${availableWidth}px`,
          });
        },
        padding: COLLISION_PADDING,
      }),
      showArrow ? arrow({ element: arrowRef, padding: ARROW_PADDING }) : null,
    ],
    open,
    placement,
    onOpenChange: handleOpenChange,
    whileElementsMounted: autoUpdate,
  });

  // Inside a TooltipDelayGroup the group owns the timing once something is open,
  // so moving along a row swaps instantly. Standalone, currentId stays null.
  const groupContext = useDelayGroup(context);
  const hoverDelay = groupContext.currentId === null ? delay : groupContext.delay;

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: groupContext.isInstantPhase
      ? { close: groupContext.currentId === context.floatingId ? TRANSITION_MS : 0, open: 0 }
      : TRANSITION_MS,
    initial: { opacity: 0, transform: "scale(0.90)" },
  });

  const interactions = useInteractions([
    useHover(context, {
      delay: hoverDelay,
      handleClose: interactive ? safePolygon({ blockPointerEvents: false }) : null,
      // Enter only, or nudging the pointer reopens what Escape just dismissed.
      move: false,
    }),
    useFocus(context),
    useDismiss(context),
    useRole(context, { role: "tooltip" }),
  ]);

  // `ref` isn't on ReactElement until React 19, and isValidElement leaves `props` as
  // any, so pin both once here. Merging refs keeps any the caller set on the trigger.
  const trigger = children as ReactElement<Record<string, unknown>> & { ref?: Ref<unknown> };
  const triggerRef = useMergeRefs([refs.setReference, referenceRef, trigger.ref]);

  // Guarded despite the types, so an absent or empty body gives a bare trigger.
  const body = customContent ?? content;

  if (disabled || !isValidElement(children) || !body) {
    // Kept as the reference so a tooltip re-enabled mid-close has somewhere to be placed.
    // cloneElement is the only way to put a ref on a caller's element before React 19.
    // eslint-disable-next-line @eslint-react/no-clone-element
    return isValidElement(children) ? cloneElement(trigger, { ref: triggerRef }) : children;
  }

  const referenceProps = interactions.getReferenceProps({ ref: triggerRef, ...trigger.props });

  // Close on press, so the tooltip never sits over a menu or popover the same
  // trigger opens. `move: false` keeps it closed until the pointer re-enters.
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    (
      referenceProps.onPointerDown as ((event: ReactPointerEvent<HTMLElement>) => void) | undefined
    )?.(event);
    setOpen(false);
  };

  return (
    <>
      {/* Floating UI's documented trigger pattern, for the reason given above. */}
      {/* eslint-disable-next-line @eslint-react/no-clone-element */}
      {cloneElement(trigger, { ...referenceProps, onPointerDown: handlePointerDown })}

      {isMounted && (
        <FloatingPortal id={OVERLAY_HOST_ID}>
          <div
            className={joinClasses("nxm-tooltip-positioner", {
              "nxm-tooltip-positioner-interactive": interactive,
            })}
            ref={refs.setFloating}
            style={floatingStyles}
            {...interactions.getFloatingProps()}
          >
            <div className={joinClasses(["nxm-tooltip", className])} style={transitionStyles}>
              {/* The wrapper stays for both: it carries the scroll clamp, which
                  can't sit on .nxm-tooltip without clipping the arrow. */}
              <div
                className={joinClasses("nxm-tooltip-body", {
                  "nxm-tooltip-content": customContent === undefined,
                })}
              >
                {body}
              </div>

              {showArrow && (
                <FloatingArrow
                  className="nxm-tooltip-arrow"
                  context={context}
                  height={ARROW_HEIGHT}
                  ref={arrowRef}
                  strokeWidth={ARROW_STROKE_WIDTH}
                  width={ARROW_WIDTH}
                />
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
