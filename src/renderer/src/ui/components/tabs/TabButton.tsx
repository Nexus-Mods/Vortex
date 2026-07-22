import numeral from "numeral";
import React, { useEffect, useRef, type ButtonHTMLAttributes } from "react";

import { getTabId } from "@/ui/utils/getTabId";
import { joinClasses } from "@/ui/utils/joinClasses";

import { useTabContext } from "./Tabs.context";

export type ITabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
  name: string;
  label?: React.ReactNode;
};

/**
 * Standard tab component, implemented as a button. Clicking it will reveal the
 * content for the selected tab.
 *
 * `name` is the stable identity used to match this button to its `TabPanel` and
 * to key the selection (via `getTabId`); keep it language-independent when the
 * selection is persisted or deep-linked. Pass `label` to display something other
 * than `name` (e.g. a translated string) while keeping `name` stable; it defaults
 * to `name`.
 */
export const TabButton = ({
  className,
  count,
  disabled,
  label,
  name,
  ...props
}: ITabButtonProps) => {
  const ref = useRef<HTMLButtonElement>(null!);
  const { onKeyDown, onTabClick, registerTab, selectedTab, tabListId, tabType } = useTabContext();

  const tabId = getTabId(name);
  const selected = selectedTab === getTabId(name);

  // Register the tab ref with the parent tab bar to set focus on keydown
  useEffect(() => registerTab({ disabled, name: tabId, ref }), [disabled, tabId, registerTab]);

  return (
    <button
      aria-controls={`tabcontent-${tabId}`}
      aria-selected={selected}
      className={joinClasses(["nxm-tab-button", className], {
        "nxm-tab-button-disabled": disabled,
        "nxm-tab-button-selected": selected,
      })}
      disabled={disabled}
      id={`tablist-${tabListId}-${tabId}`}
      ref={ref}
      role="tab"
      tabIndex={selected ? 0 : -1}
      type="button"
      onClick={() => onTabClick(tabId)}
      onKeyDown={onKeyDown}
      {...props}
    >
      <span className="nxm-tab-button-content">
        {label ?? name}

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
