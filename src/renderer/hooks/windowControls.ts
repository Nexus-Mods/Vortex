import { useEffect, useState } from "react";

import { getPreloadApi, getWindowId } from "../util/preloadAccess";

export const minimize = () => {
  const api = getPreloadApi();
  const windowId = getWindowId();
  void api.window.minimize(windowId);
};

export const close = () => {
  const api = getPreloadApi();
  const windowId = getWindowId();
  void api.window.close(windowId);
};

export const toggleMaximize = () => {
  const api = getPreloadApi();
  const windowId = getWindowId();
  void api.window.isMaximized(windowId).then((isMaximized) => {
    if (isMaximized) {
      void api.window.unmaximize(windowId);
    } else {
      void api.window.maximize(windowId);
    }
  });
};

export const useIsMaximized = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = getPreloadApi();
    const windowId = getWindowId();

    // Fetch initial maximized state
    void api.window.isMaximized(windowId).then((maximized) => {
      setIsMaximized(maximized);
    });

    // Subscribe to window events
    const unsubscribeMaximize = api.window.onMaximize(() =>
      setIsMaximized(true),
    );
    const unsubscribeUnmaximize = api.window.onUnmaximize(() =>
      setIsMaximized(false),
    );

    return () => {
      unsubscribeMaximize();
      unsubscribeUnmaximize();
    };
  }, []);

  return isMaximized;
};
