import React, { type FC } from "react";

import { IconButton } from "../controls/TooltipControls";
import {
  close,
  minimize,
  toggleMaximize,
  useIsMaximized,
} from "../hooks/windowControls";

export const WindowControls: FC = () => {
  const isMaximized = useIsMaximized();

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
};

export default WindowControls;
