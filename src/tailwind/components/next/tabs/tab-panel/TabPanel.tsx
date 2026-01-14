"use client";

import * as React from "react";
import type { ReactNode } from "react";

import { getTabId } from "../../utils";
import { useTabContext } from "../tabs.context";

/**
 * Tab Content component acts as a wrapper that shows/hides content
 * depending on whether the tab is selected
 */
export const TabPanel = ({
  children,
  name,
}: {
  children: ReactNode;
  name: string;
}) => {
  const { selectedTab } = useTabContext();
  const tabId = getTabId(name);

  if (selectedTab === tabId) {
    return (
      <div id={`tabcontent-${tabId}`} role="tabpanel">
        {children}
      </div>
    );
  }

  return null;
};
