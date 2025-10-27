'use client';

import * as React from 'react';
import { createContext, useContext, KeyboardEvent, MutableRefObject, ReactNode, useCallback, useState } from 'react';

import { getTabId } from '../utils';

/**
 * Arguments for the register tab method
 */
type RegisterTabArgs = {
  name: string;
  ref: MutableRefObject<HTMLButtonElement | HTMLAnchorElement>;
  type: 'link' | 'button';
};

/**
 * State for the TabContext
 */
export interface TabsState {
  onKeyDown: (event: KeyboardEvent) => void;
  onTabClick: (tabName: string) => void;
  registerTab: (args: RegisterTabArgs) => void;
  selectedTab: string;
  tabListId: string;
}

/**
 * Props for the TabProvider
 */
export interface TabProviderProps {
  children?: ReactNode;
  onSetSelectedTab?: (tab: string) => void;
  tab: string;
  tabListId: string;
}

/**
 * The React context for the TabProvider
 */
export const TabContext = createContext<TabsState | undefined>(undefined);

/**
 * React component to provide context to tabs
 */
export const TabProvider = ({ children, onSetSelectedTab, tab, tabListId }: TabProviderProps) => {
  // Handles callback for tab select behaviour (e.g. scrolling)
  const setSelectedTab = (tabToSet: string) => {
    onSetSelectedTab?.(tabToSet);
  };

  // Tracks the currently selected tab in id format
  const selectedTab = getTabId(tab);

  // Store references to each tab to manage focus. References are keyed by tab name
  const [tabs, setTabs] = useState<Record<string, Omit<RegisterTabArgs, 'name'>>>({});

  // Tracks all tabs in id format
  const tabIds = Object.keys(tabs);

  // Registers tabs in the `tabs` state variable to manage keyboard focus
  const registerTab = useCallback(
    ({ name, ref, type }: RegisterTabArgs) =>
      setTabs((currentTabs) => ({
        ...currentTabs,
        [name]: { ref, type },
      })),
    [],
  );

  // Perform keyboard navigation between tabs within the tab list
  const onKeyDown = (event: KeyboardEvent) => {
    // Handle focus and selection separately
    const focusedIndex = tabIds.findIndex((t) => tabs[t].ref.current === document.activeElement);
    const selectedIndex = tabIds.findIndex((t) => t === selectedTab);

    // Track focused tab if it exists, else track selected tab
    let index = focusedIndex >= 0 ? focusedIndex : selectedIndex;

    switch (event.key) {
      case 'Home': {
        index = 0;
        event.preventDefault();
        break;
      }
      case 'End': {
        index = tabIds.length - 1;
        event.preventDefault();
        break;
      }
      case 'ArrowLeft': {
        index -= 1;
        break;
      }
      case 'ArrowRight': {
        index += 1;
        break;
      }
    }

    // Wrap the index around if it overflows using double modulo
    index = ((index % tabIds.length) + tabIds.length) % tabIds.length;

    // Get the tab id of the new selected tab
    const newTabId = tabIds[index];

    // If new tab is a button, select the new tab
    if (tabs[newTabId].type === 'button') {
      setSelectedTab(newTabId);
    }

    // Focus the new tab
    tabs[newTabId].ref.current.focus();
  };

  return (
    <TabContext.Provider
      value={{
        onKeyDown,
        onTabClick: setSelectedTab,
        registerTab,
        selectedTab,
        tabListId,
      }}
    >
      {children}
    </TabContext.Provider>
  );
};

/**
 * Hook to enforce that context has a provider
 * COMPATIBILITY FIX: Using useContext instead of use() for React 16 compatibility
 */
export const useTabContext = (): TabsState => {
  const context = useContext(TabContext);

  if (context === undefined) {
    throw new Error('useTabContext must be used within a TabProvider');
  }

  return context;
};
