import React, { lazy, Suspense } from "react";

/** Loaded on first render, so a production build, which never renders it, never requires it. */
const ReactQueryDevtoolsPanel = lazy(() =>
  import("@tanstack/react-query-devtools/production").then((module) => ({
    default: module.ReactQueryDevtoolsPanel,
  })),
);

interface IQueryDevtoolsProps {
  /** Called from the panel's own close button, the TanStack logo in its header. */
  onClose: () => void;
}

/**
 * TanStack Query's devtools, docked along the bottom of the window: the cached queries, their
 * keys, data and status. Opened from the `DevToolsMenu`, in development only; it sits at the
 * dropdown level so the menu, portalled after it, opens over it to close it again.
 */
export const QueryDevtools = ({ onClose }: IQueryDevtoolsProps) => (
  <div className="fixed inset-x-0 bottom-0 z-dropdown">
    <Suspense fallback={null}>
      <ReactQueryDevtoolsPanel onClose={onClose} />
    </Suspense>
  </div>
);
