import React, { type ReactNode } from "react";

import { useTabContext } from "./Tabs.context";

export const TabPanel = ({ children, id }: { children: ReactNode; id: string }) => {
  const { selectedTab } = useTabContext();

  if (selectedTab === id) {
    return (
      <div id={`tabcontent-${id}`} role="tabpanel">
        {children}
      </div>
    );
  }

  return null;
};
