/**
 * Tabs Demo Component
 * Showcases the tabs system with various features
 */

import * as React from "react";
import { useState } from "react";

import { Typography } from "../typography";
import { TabBar } from "./tab-bar";
import { TabButton, TabLink } from "./tab";
import { TabPanel } from "./tab-panel";
import { TabProvider } from "./tabs.context";

export const TabsDemo = () => {
  const [selectedTab1, setSelectedTab1] = useState("overview");
  const [selectedTab2, setSelectedTab2] = useState("overview");

  return (
    <div className="space-y-8">
      <Typography as="h2" typographyType="heading-lg">
        Tabs Component System
      </Typography>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-md">
          Basic Tabs with Count Badges
        </Typography>

        <TabProvider
          tab={selectedTab1}
          tabListId="demo-tabs"
          onSetSelectedTab={setSelectedTab1}
        >
          <TabBar>
            <TabButton name="Overview" />
            <TabButton name="Files" count={42} />
            <TabButton name="Comments" count={156} />
            <TabButton name="Settings" />
          </TabBar>

          <div className="mt-6">
            <TabPanel name="Overview">
              <div className="space-y-4">
                <Typography typographyType="body-lg" appearance="moderate">
                  <strong>Overview Tab Content</strong>
                </Typography>
                <Typography typographyType="body-md" appearance="subdued">
                  This is the overview panel. Click other tabs to see different
                  content.
                </Typography>
              </div>
            </TabPanel>

            <TabPanel name="Files">
              <div className="space-y-4">
                <Typography typographyType="body-lg" appearance="moderate">
                  <strong>Files Tab Content (42 files)</strong>
                </Typography>
                <Typography typographyType="body-md" appearance="subdued">
                  Notice the count badge showing 42 files. This tab demonstrates
                  count badges.
                </Typography>
              </div>
            </TabPanel>

            <TabPanel name="Comments">
              <div className="space-y-4">
                <Typography typographyType="body-lg" appearance="moderate">
                  <strong>Comments Tab Content (156 comments)</strong>
                </Typography>
                <Typography typographyType="body-md" appearance="subdued">
                  The count badge uses the numeral library for proper formatting
                  (e.g., 1,234).
                </Typography>
              </div>
            </TabPanel>

            <TabPanel name="Settings">
              <div className="space-y-4">
                <Typography typographyType="body-lg" appearance="moderate">
                  <strong>Settings Tab Content</strong>
                </Typography>
                <Typography typographyType="body-md" appearance="subdued">
                  This tab has no count badge, which is optional.
                </Typography>
              </div>
            </TabPanel>
          </div>
        </TabProvider>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-md">
          Tabs with Link Tab
        </Typography>

        <TabProvider
          tab={selectedTab2}
          tabListId="demo-tabs-with-link"
          onSetSelectedTab={setSelectedTab2}
        >
          <TabBar>
            <TabButton name="Overview" />
            <TabButton name="Details" />
            <TabLink
              name="External Docs"
              href="https://nexusmods.com"
              target="_blank"
            />
          </TabBar>

          <div className="mt-6">
            <TabPanel name="Overview">
              <Typography typographyType="body-md" appearance="subdued">
                Overview content. Notice the "External Docs" tab is a link, not
                a button.
              </Typography>
            </TabPanel>

            <TabPanel name="Details">
              <Typography typographyType="body-md" appearance="subdued">
                Details content. Link tabs can be focused with keyboard
                navigation but don't change content.
              </Typography>
            </TabPanel>
          </div>
        </TabProvider>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-md">
          Keyboard Navigation
        </Typography>

        <div className="bg-surface-mid p-4 rounded space-y-2">
          <Typography typographyType="body-sm" appearance="subdued">
            <strong>Arrow Left/Right:</strong> Navigate between tabs
          </Typography>
          <Typography typographyType="body-sm" appearance="subdued">
            <strong>Home:</strong> Jump to first tab
          </Typography>
          <Typography typographyType="body-sm" appearance="subdued">
            <strong>End:</strong> Jump to last tab
          </Typography>
          <Typography typographyType="body-sm" appearance="subdued">
            <strong>Tab wrapping:</strong> Last tab → First tab (and vice versa)
          </Typography>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-md">
          Features
        </Typography>

        <Typography
          as="ul"
          typographyType="body-md"
          appearance="subdued"
          className="list-disc list-inside space-y-2"
        >
          <li>Context-based state management with TabProvider</li>
          <li>Button tabs (selectable) and Link tabs (focusable only)</li>
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
