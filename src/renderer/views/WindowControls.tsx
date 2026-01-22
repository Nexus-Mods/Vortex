import type * as RemoteT from "@electron/remote";
import type { BrowserWindow } from "electron";
import * as React from "react";
import { IconButton } from "../controls/TooltipControls";
import lazyRequire from "../../util/lazyRequire";

const remote = lazyRequire<typeof RemoteT>(() => require("@electron/remote"));

const getWindow = (() => {
  let res: BrowserWindow;
  return () => {
    if (res === undefined) {
      res = remote.getCurrentWindow();
    }
    return res;
  };
})();

function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = React.useState(() =>
    getWindow().isMaximized(),
  );
  const closedRef = React.useRef(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

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
        id="window-minimize"
        className="window-control"
        tooltip=""
        icon="window-minimize"
        onClick={minimize}
      />
      <IconButton
        id="window-maximize"
        className="window-control"
        tooltip=""
        icon={isMaximized ? "window-restore" : "window-maximize"}
        onClick={toggleMaximize}
      />
      <IconButton
        id="window-close"
        className="window-control"
        tooltip=""
        icon="window-close"
        onClick={close}
      />
    </div>
  );
}

export default WindowControls;
