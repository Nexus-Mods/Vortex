import React, { type FocusEvent, type PointerEvent, type ReactNode, useState } from "react";

import { Tooltip } from "../Tooltip";

/** Where a control's title goes once it's taken off, so the browser's own tooltip can't show. */
const MOVED_TITLE = "data-nxm-title";

/**
 * The body while no control is pointed at, never shown, as it's only open with a title: an
 * empty one would leave the trigger without the focus handlers that open it.
 */
const NO_TITLE = " ";

/** A control inside, and the title to show for it. */
interface ITitled {
  element: Element;
  title: string;
}

/**
 * The titled control an event came from, inside `root`, its title moved off it. One with no text
 * of its own keeps the title as its name. React puts back a title it changes, so a live title
 * wins over one moved earlier.
 */
const titledControl = (target: EventTarget, root: Element): ITitled | null => {
  const element = target instanceof Element ? target.closest(`[title], [${MOVED_TITLE}]`) : null;
  if (element === null || !root.contains(element)) {
    return null;
  }

  const live = element.getAttribute("title");
  if (live !== null) {
    element.removeAttribute("title");
    element.setAttribute(MOVED_TITLE, live);
    if (!element.textContent?.trim()) {
      element.setAttribute("aria-label", live);
    }
  }

  const title = element.getAttribute(MOVED_TITLE);
  return title ? { element, title } : null;
};

interface ILegacyTitleTooltipsProps {
  /** Legacy controls, whose titles show in the modern layout's tooltip. */
  children: ReactNode;
}

/**
 * Shows the titles of the legacy controls inside it, such as an extension's in a new table's
 * cell, in the modern layout's tooltip, pointing at the control, in place of the browser's own.
 */
export const LegacyTitleTooltips = ({ children }: ILegacyTitleTooltipsProps) => {
  const [titled, setTitled] = useState<ITitled | null>(null);
  const [open, setOpen] = useState(false);

  const point = (event: PointerEvent<HTMLElement> | FocusEvent<HTMLElement>) =>
    setTitled(titledControl(event.target, event.currentTarget));

  return (
    <Tooltip
      anchor={titled?.element ?? null}
      content={titled?.title ?? NO_TITLE}
      open={open && titled !== null}
      onOpenChange={setOpen}
    >
      <span className="inline-flex max-w-full items-center" onFocus={point} onPointerOver={point}>
        {children}
      </span>
    </Tooltip>
  );
};
