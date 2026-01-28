import type * as RemoteT from "@electron/remote";
import type { BrowserWindow } from "electron";

import * as React from "react";

import lazyRequire from "../../util/lazyRequire";
import { IconButton } from "../controls/TooltipControls";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const remote = lazyRequire(() => require("@electron/remote") as typeof RemoteT);

const getWindow = (() => {
  let res: BrowserWindow;
  return () => {
    if (res === undefined) {
      res = remote.getCurrentWindow();
    }
    return res;
  };
})();

export function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = React.useState(() =>
    getWindow().isMaximized(),
  );
  const closedRef = React.useRef(false);
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    const win = getWindow();

    const onMaximize = () => {
      setIsMaximized(true);
      forceUpdate();
    };

    const onUnMaximize = () => {
      setIsMaximized(false);
      forceUpdate();
    };

    const onClose = () => {
      closedRef.current = true;
    };

    win.on("maximize", onMaximize);
    win.on("unmaximize", onUnMaximize);
    win.on("close", onClose);

    return () => {
      win.removeListener("maximize", onMaximize);
      win.removeListener("unmaximize", onUnMaximize);
      win.removeListener("close", onClose);
    };
  }, []);

  const minimize = React.useCallback(() => {
    getWindow().minimize();
  }, []);

  const toggleMaximize = React.useCallback(() => {
    const win = getWindow();
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }, []);

  const close = React.useCallback(() => {
    getWindow().close();
  }, []);

  if (closedRef.current) {
    return null;
  }

  return (
    <div id="window-controls">
      <IconButton
        className="window-control"
        icon="window-minimize"
        id="window-minimize"
        tooltip=""
        onClick={minimize}
      />

      <IconButton
        className="window-control"
        icon={isMaximized ? "window-restore" : "window-maximize"}
        id="window-maximize"
        tooltip=""
        onClick={toggleMaximize}
      />

      <IconButton
        className="window-control"
        icon="window-close"
        id="window-close"
        tooltip=""
        onClick={close}
      />
    </div>
  );
}

export default WindowControls;
