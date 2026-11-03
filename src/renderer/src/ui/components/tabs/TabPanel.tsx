import React, { type ReactNode } from "react";

import { useTabContext } from "./Tabs.context";

interface ITabPanelProps {
  /** The panel's content, shown while its tab is selected. */
  children: ReactNode;
  /** Extra classes for the panel. */
  className?: string;
  /** Matches the `panelId` of its TabButton. */
  id: string;
}

export const TabPanel = ({ children, className, id }: ITabPanelProps) => {
  const { selectedTab } = useTabContext();

  if (selectedTab === id) {
    return (
      <div className={className} id={`tabcontent-${id}`} role="tabpanel">
        {children}
      </div>
    );
  }

  return null;
};
