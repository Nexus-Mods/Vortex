import React, { type ButtonHTMLAttributes, type FC } from "react";

import { close, minimize, toggleMaximize, useIsMaximized } from "@/hooks";
import { Icon, type ISymbolSource, symbolProps } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "@/ui/utils/joinClasses";

interface WindowControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  symbol: ISymbolSource;
  title: string;
}

const WindowControlButton: FC<React.PropsWithChildren<WindowControlButtonProps>> = ({
  className,
  symbol,
  title,
  ...props
}) => (
  <Tooltip content={title} placement="bottom">
    <button
      aria-label={title}
      className={joinClasses([
        "flex h-11 w-8.5 items-center justify-center text-neutral-subdued -outline-offset-2 transition-colors hover:text-neutral-strong",
        className,
      ])}
      {...props}
    >
      <Icon {...symbolProps(symbol)} size="sm" />
    </button>
  </Tooltip>
);

export const WindowControls: FC<React.PropsWithChildren<unknown>> = () => {
  const isMaximized = useIsMaximized();

  return (
    <TooltipDelayGroup as="div" className="flex">
      <WindowControlButton
        className="hover:bg-surface-mid"
        symbol="minimize"
        title="Minimize"
        onClick={minimize}
      />

      <WindowControlButton
        className="hover:bg-surface-mid"
        symbol={isMaximized ? "select_window_2" : "crop_square"}
        title={isMaximized ? "Restore" : "Maximize"}
        onClick={toggleMaximize}
      />

      <WindowControlButton
        className="w-9 hover:bg-danger-subdued"
        symbol="close"
        title="Close"
        onClick={close}
      />
    </TooltipDelayGroup>
  );
};
