import numeral from "numeral";
import React, { useEffect, useRef, type ButtonHTMLAttributes } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { useTabContext } from "./Tabs.context";

export type ITabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
  name: string;
  panelId: string;
};

export const TabButton = ({
  className,
  count,
  disabled,
  name,
  panelId,
  ...props
}: ITabButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null!);
  const { onKeyDown, onTabClick, registerTab, selectedTab, tabListId, tabType } = useTabContext();

  const selected = selectedTab === panelId;

  useEffect(() => registerTab({ disabled, name: panelId, ref }), [disabled, panelId, registerTab]);

  return (
    <button
      aria-controls={`tabcontent-${panelId}`}
      aria-selected={selected}
      className={joinClasses(["nxm-tab-button", className], {
        "nxm-tab-button-disabled": disabled,
        "nxm-tab-button-selected": selected,
      })}
      disabled={disabled}
      id={`tablist-${tabListId}-${panelId}`}
      ref={ref}
      role="tab"
      tabIndex={selected ? 0 : -1}
      type="button"
      onClick={() => onTabClick(panelId)}
      onKeyDown={onKeyDown}
      {...props}
    >
      <span className="nxm-tab-button-content">
        {name}

        {count !== undefined && (
          <span className="nxm-tab-button-count">
            {tabType === "secondary"
              ? `(${numeral(count).format("0,0")})`
              : numeral(count).format("0,0")}
          </span>
        )}
      </span>
    </button>
  );
};
