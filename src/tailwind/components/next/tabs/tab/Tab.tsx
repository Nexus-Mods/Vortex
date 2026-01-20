"use client";

import * as React from "react";
import type { ButtonHTMLAttributes } from "react";
import { useEffect, useRef } from "react";
import numeral from "numeral";

import { getTabId, joinClasses } from "../../utils";

import { useTabContext } from "../tabs.context";

export type TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
  name: string;
};

/**
 * Standard tab component, implemented as a button. Clicking it will reveal the
 * content for the selected tab.
 */
export const TabButton = ({
  className,
  count,
  disabled,
  name,
  ...props
}: TabButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null!);
  const {
    onKeyDown,
    onTabClick,
    registerTab,
    selectedTab,
    tabListId,
    tabType,
  } = useTabContext();

  const tabId = getTabId(name);
  const selected = selectedTab === getTabId(name);

  // Register the tab ref with the parent tab bar to set focus on keydown
  useEffect(
    () => registerTab({ name: tabId, ref, type: "button" }),
    [tabId, registerTab],
  );

  return (
    <button
      ref={ref}
      aria-controls={`tabcontent-${tabId}`}
      aria-selected={selected}
      className={joinClasses(["nxm-tab-button", className], {
        "nxm-tab-button-disabled": disabled,
        "nxm-tab-button-selected": selected,
      })}
      disabled={disabled}
      id={`tablist-${tabListId}-${tabId}`}
      role="tab"
      tabIndex={selected ? 0 : -1}
      type="button"
      onClick={() => onTabClick(tabId)}
      onKeyDown={onKeyDown}
      {...props}
    >
      {name}

      {count !== undefined && (
        <span className="nxm-tab-button-count">
          {tabType === "secondary"
            ? `(${numeral(count).format("0,0")})`
            : numeral(count).format("0,0")}
        </span>
      )}
    </button>
  );
};
