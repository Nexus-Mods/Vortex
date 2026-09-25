import { Portal } from "@headlessui/react";
import React, {
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * Cancels the page zoom for the window chrome, which stays at 100% while the
 * content zooms. `--app-zoom` is kept equal to the frame's zoom by `initializeZoom`.
 */
export const CHROME_ZOOM = "calc(1 / var(--app-zoom, 1))";
export const CHROME_ZOOM_STYLE: CSSProperties = { zoom: CHROME_ZOOM };

const ChromeOverlayRootContext = createContext<HTMLElement | null>(null);

/** Where an overlay opened from the chrome renders, or null outside the chrome. */
export const useChromeOverlayRoot = () => useContext(ChromeOverlayRootContext);

/**
 * Chrome at 100% whose tooltips and popovers are at 100% too. Overlays are
 * portalled out of the chrome, so without this they would render at the page's
 * zoom beside it. They go to a layer covering the window with the same
 * cancelling zoom instead. Floating UI positions against that layer, measuring
 * its scale, so an overlay still lands on its trigger.
 */
export const ChromeZoomScope = ({ children }: { children: ReactNode }) => {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const attach = useCallback((element: HTMLDivElement | null) => {
    rootRef.current = element;
    setRoot(element);
  }, []);

  return (
    <>
      {createPortal(
        <div
          className="pointer-events-none absolute inset-0 *:pointer-events-auto"
          data-testid="chrome-overlays"
          ref={attach}
          style={CHROME_ZOOM_STYLE}
        />,
        document.body,
      )}

      <ChromeOverlayRootContext.Provider value={root}>
        {/* Headless UI exports its portal group only under this deprecated name. */}
        <Portal.Group target={rootRef}>{children}</Portal.Group>
      </ChromeOverlayRootContext.Provider>
    </>
  );
};
