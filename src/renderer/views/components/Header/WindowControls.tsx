import {
  mdiWindowClose,
  mdiWindowMaximize,
  mdiWindowMinimize,
  mdiWindowRestore,
} from "@mdi/js";
import React, { type ButtonHTMLAttributes, type FC } from "react";

import {
  close,
  minimize,
  toggleMaximize,
  useIsMaximized,
} from "../../../hooks";
import { Icon } from "../../../ui/components/icon/Icon";
import { joinClasses } from "../../../ui/utils/joinClasses";

interface WindowControlButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconPath: string;
}

const WindowControlButton: FC<WindowControlButtonProps> = ({
  className,
  iconPath,
  ...props
}) => (
  <button
    className={joinClasses([
      "flex size-11 items-center justify-center text-neutral-subdued -outline-offset-2 transition-colors hover:text-neutral-strong",
      className,
    ])}
    {...props}
  >
    <Icon path={iconPath} size="sm" />
  </button>
);

export const WindowControls: FC = () => {
  const isMaximized = useIsMaximized();

  return (
    <div className="flex">
      <WindowControlButton
        className="hover:bg-surface-mid"
        iconPath={mdiWindowMinimize}
        title="Minimize"
        onClick={minimize}
      />

      <WindowControlButton
        className="hover:bg-surface-mid"
        iconPath={isMaximized ? mdiWindowRestore : mdiWindowMaximize}
        title={isMaximized ? "Restore" : "Maximize"}
        onClick={toggleMaximize}
      />

      <WindowControlButton
        className="hover:bg-danger-subdued"
        iconPath={mdiWindowClose}
        title="Close"
        onClick={close}
      />
    </div>
  );
};
