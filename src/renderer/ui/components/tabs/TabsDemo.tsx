/**
 * Tabs Demo Component
 * Showcases the tabs system with various features
 */

import React, { useState } from "react";

import { Typography } from "../typography";
import { TabButton } from "./tab";
import { TabBar } from "./tab-bar";
import { TabPanel } from "./tab-panel";
import { TabProvider } from "./tabs.context";

export const TabsDemo = () => {
  const [selectedTab1, setSelectedTab1] = useState("overview");
  const [selectedTab2, setSelectedTab2] = useState("overview");

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Tabs
        </Typography>

        <Typography appearance="subdued">
          A tabbed interface system with context-based state management,
          keyboard navigation, and accessibility support.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Primary Tabs
        </Typography>

        <TabProvider
          tab={selectedTab1}
          tabListId="demo-tabs"
          onSetSelectedTab={setSelectedTab1}
        >
          <TabBar>
            <TabButton name="Overview" />

            <TabButton count={42} name="Files" />

            <TabButton count={156} name="Comments" />

            <TabButton name="Settings" />

            <TabButton disabled={true} name="Disabled" />
          </TabBar>

          <div className="mt-6">
            <TabPanel name="Overview">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">Overview Tab Content</p>

                <p>
                  This is the overview panel. Click other tabs to see different
                  content.
                </p>
              </Typography>
            </TabPanel>

            <TabPanel name="Files">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">Files Tab Content (42 files)</p>

                <p>
                  Notice the count badge showing 42 files. This tab demonstrates
                  count badges.
                </p>
              </Typography>
            </TabPanel>

            <TabPanel name="Comments">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">
                  Comments Tab Content (156 comments)
                </p>

                <p>
                  The count badge uses the numeral library for proper formatting
                  (e.g., 1,234).
                </p>
              </Typography>
            </TabPanel>

            <TabPanel name="Settings">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">Settings Tab Content</p>

                <p>This tab has no count badge, which is optional.</p>
              </Typography>
            </TabPanel>

            <TabPanel name="Disabled">
              <Typography appearance="subdued" as="div">
                <p className="font-semibold">Disabled</p>
              </Typography>
            </TabPanel>
          </div>
        </TabProvider>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Secondary Tabs
        </Typography>

        <TabProvider
          tab={selectedTab2}
          tabListId="demo-secondary-tabs"
          tabType="secondary"
          onSetSelectedTab={setSelectedTab2}
        >
          <TabBar>
            <TabButton name="Overview" />

            <TabButton count={42} name="Files" />

            <TabButton count={156} name="Comments" />

            <TabButton name="Settings" />

            <TabButton disabled={true} name="Disabled" />
          </TabBar>

          <div className="mt-6">
            <TabPanel name="Overview">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">Overview Tab Content</p>

                <p>
                  This is the overview panel. Click other tabs to see different
                  content.
                </p>
              </Typography>
            </TabPanel>

            <TabPanel name="Files">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">Files Tab Content (42 files)</p>

                <p>
                  Notice the count badge showing 42 files. This tab demonstrates
                  count badges.
                </p>
              </Typography>
            </TabPanel>

            <TabPanel name="Comments">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">
                  Comments Tab Content (156 comments)
                </p>

                <p>
                  The count badge uses the numeral library for proper formatting
                  (e.g., 1,234).
                </p>
              </Typography>
            </TabPanel>

            <TabPanel name="Settings">
              <Typography appearance="subdued" as="div" className="space-y-4">
                <p className="font-semibold">Settings Tab Content</p>

                <p>This tab has no count badge, which is optional.</p>
              </Typography>
            </TabPanel>

            <TabPanel name="Disabled">
              <Typography appearance="subdued" as="div">
                <p className="font-semibold">Disabled</p>
              </Typography>
            </TabPanel>
          </div>
        </TabProvider>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Keyboard Navigation
        </Typography>

        <Typography
          appearance="subdued"
          as="ul"
          className="list-inside list-disc space-y-2"
        >
          <li>
            <span className="font-semibold">Arrow Left/Right:</span> Navigate
            between tabs
          </li>

          <li>
            <span className="font-semibold">Home:</span> Jump to first tab
          </li>

          <li>
            <span className="font-semibold">End:</span> Jump to last tab
          </li>

          <li>
            <span className="font-semibold">Tab wrapping:</span> Last tab →
            First tab (and vice versa)
          </li>
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Features
        </Typography>

        <Typography
          appearance="subdued"
          as="ul"
          className="list-inside list-disc space-y-2"
        >
          <li>Context-based state management with TabProvider</li>

          <li>Primary and secondary tab styles</li>

          <li>Optional count badges with number formatting</li>

          <li>Full keyboard navigation (Arrow keys, Home, End)</li>

          <li>Complete ARIA accessibility support</li>

          <li>Horizontal scrolling for many tabs with custom scrollbar</li>

          <li>Focus visible indicators for keyboard users</li>
        </Typography>
      </div>
    </div>
  );
};
