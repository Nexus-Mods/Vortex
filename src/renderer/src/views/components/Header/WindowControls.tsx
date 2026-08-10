import { mdiWindowClose, mdiWindowMaximize, mdiWindowMinimize, mdiWindowRestore } from "@mdi/js";
import React, { type ButtonHTMLAttributes, type FC } from "react";

import { close, minimize, toggleMaximize, useIsMaximized } from "../../../hooks";
import { Icon } from "../../../ui/components/icon/Icon";
import { Tooltip } from "../../../ui/components/tooltip/Tooltip";
import { TooltipDelayGroup } from "../../../ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "../../../ui/utils/joinClasses";

interface WindowControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconPath: string;
  title: string;
}

const WindowControlButton: FC<React.PropsWithChildren<WindowControlButtonProps>> = ({
  className,
  iconPath,
  title,
  ...props
}) => (
  <Tooltip content={title} placement="bottom">
    <button
      aria-label={title}
      className={joinClasses([
        "flex size-11 items-center justify-center text-neutral-subdued -outline-offset-2 transition-colors hover:text-neutral-strong",
        className,
      ])}
      {...props}
    >
      <Icon path={iconPath} size="sm" />
    </button>
  </Tooltip>
);

export const WindowControls: FC<React.PropsWithChildren<unknown>> = () => {
  const isMaximized = useIsMaximized();

  return (
    <TooltipDelayGroup as="div" className="flex">
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
    </TooltipDelayGroup>
  );
};
