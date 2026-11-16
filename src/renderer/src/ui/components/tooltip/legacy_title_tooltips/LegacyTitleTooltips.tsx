import React, {
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Tooltip } from "../Tooltip";

/** Where a control's title goes once it's taken off, so the browser's own tooltip can't show. */
const MOVED_TITLE = "data-nxm-title";

/** Marks the legacy controls whose titles a {@link LegacyTitleTooltips} around them shows. */
const TITLED_AREA = "data-nxm-legacy-titled";

/**
 * The body while no control is pointed at, never shown, as it's only open with a title: an
 * empty one would leave the trigger bare, with nothing to place the tooltip by.
 */
const NO_TITLE = " ";

/** As long as the modern layout's own tooltips wait before opening on hover. */
const OPEN_DELAY = 250;

/** A control inside, and the title to show for it. */
interface ITitled {
  element: Element;
  title: string;
}

/**
 * Takes a control's title off it, so the browser's own tooltip can't show, keeping it as the
 * name of one with no text of its own. React puts back a title it changes, so this runs again.
 */
const moveTitle = (element: Element) => {
  const live = element.getAttribute("title");
  if (live === null) {
    return;
  }
  element.removeAttribute("title");
  element.setAttribute(MOVED_TITLE, live);
  if (!element.textContent?.trim()) {
    element.setAttribute("aria-label", live);
  }
};

/** The titled control an event came from, in a titled area inside `root`, its title moved off. */
const titledControl = (target: EventTarget | null, root: Element): ITitled | null => {
  if (!(target instanceof Element)) {
    return null;
  }
  const area = target.closest(`[${TITLED_AREA}]`);
  const element = target.closest(`[title], [${MOVED_TITLE}]`);
  if (area === null || element === null || !area.contains(element) || !root.contains(area)) {
    return null;
  }

  moveTitle(element);
  const title = element.getAttribute(MOVED_TITLE);
  return title ? { element, title } : null;
};

/** As floating-ui tells a keyboard focus from a click's, where `:focus-visible` is known. */
const isKeyboardFocus = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

interface ILegacyTitledProps {
  /** Legacy controls, such as an extension's in a new table's cell. */
  children: ReactNode;
}

/** Legacy controls whose titles show in the {@link LegacyTitleTooltips} around them. */
export const LegacyTitled = ({ children }: ILegacyTitledProps) => (
  <span className="inline-flex max-w-full items-center" {...{ [TITLED_AREA]: "" }}>
    {children}
  </span>
);

interface ILegacyTitleTooltipsProps {
  /** What the {@link LegacyTitled} controls are in, such as a table. */
  children: ReactNode;
}

/**
 * Shows the titles of the {@link LegacyTitled} controls inside it in the modern layout's
 * tooltip, pointing at the control, in place of the browser's own. One for all of them, such
 * as every extension cell in a table, as only one title shows at a time. It opens after a
 * delay on hover and at once on keyboard focus, then moves from control to control while it's
 * open, as a delay group does. It closes on a press, and when its control is replaced.
 */
export const LegacyTitleTooltips = ({ children }: ILegacyTitleTooltipsProps) => {
  const [titled, setTitled] = useState<ITitled | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const titledRef = useRef<ITitled | null>(null);
  const openTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    titledRef.current = titled;
  }, [titled]);

  const close = () => {
    window.clearTimeout(openTimer.current);
    setOpen(false);
  };

  const point = (next: ITitled | null, atOnce: boolean) => {
    if (next?.element === titled?.element) {
      return;
    }
    setTitled(next);
    if (next === null) {
      close();
    } else if (atOnce) {
      window.clearTimeout(openTimer.current);
      setOpen(true);
    } else if (!open) {
      window.clearTimeout(openTimer.current);
      openTimer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY);
    }
  };

  // React writes back a title it changes, as Endorsed's once it's clicked, which the browser
  // would show. A control replaced while it's pointed at would leave the tooltip placed by a
  // detached element, which measures as the window's corner, so it closes instead.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return undefined;
    }
    const observer = new MutationObserver((records) => {
      for (const { target } of records) {
        if (target instanceof Element && target.hasAttribute("title")) {
          const changed = titledControl(target, root);
          if (changed !== null && changed.element === titledRef.current?.element) {
            setTitled(changed);
          }
        }
      }
      if (titledRef.current?.element.isConnected === false) {
        window.clearTimeout(openTimer.current);
        setTitled(null);
        setOpen(false);
      }
    });
    observer.observe(root, { attributeFilter: ["title"], childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(openTimer.current);
    };
  }, []);

  const onPointerOver = (event: PointerEvent<HTMLElement>) =>
    point(titledControl(event.target, event.currentTarget), false);

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    if (isKeyboardFocus(event.target)) {
      point(titledControl(event.target, event.currentTarget), true);
    }
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.target === titled?.element) {
      point(null, false);
    }
  };

  return (
    <Tooltip
      anchor={titled?.element ?? null}
      content={titled?.title ?? NO_TITLE}
      open={open && titled !== null}
      // Each control opens it, not the trigger around them all, which only closes it.
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <span
        className="contents"
        ref={rootRef}
        onBlur={onBlur}
        onFocus={onFocus}
        onPointerLeave={() => point(null, false)}
        onPointerOver={onPointerOver}
      >
        {children}
      </span>
    </Tooltip>
  );
};
