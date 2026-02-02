import type * as RemoteT from "@electron/remote";
import type { BrowserWindow } from "electron";

import React, { useEffect, useState } from "react";

import lazyRequire from "../../util/lazyRequire";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const remote = lazyRequire(() => require("@electron/remote") as typeof RemoteT);

let cachedWindow: BrowserWindow | undefined;
export const getWindow = () => (cachedWindow ??= remote.getCurrentWindow());

export const minimize = () => getWindow().minimize();
export const close = () => getWindow().close();
export const toggleMaximize = () => {
  const win = getWindow();
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
};

export const useIsMaximized = () => {
  const [isMaximized, setIsMaximized] = useState(() =>
    getWindow().isMaximized(),
  );

  useEffect(() => {
    const win = getWindow();
    const onMaximize = () => setIsMaximized(true);
    const onUnmaximize = () => setIsMaximized(false);

    win.on("maximize", onMaximize);
    win.on("unmaximize", onUnmaximize);

    return () => {
      win.removeListener("maximize", onMaximize);
      win.removeListener("unmaximize", onUnmaximize);
    };
  }, []);

  return isMaximized;
};
