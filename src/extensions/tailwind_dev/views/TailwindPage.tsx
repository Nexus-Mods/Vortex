/**
 * Tailwind Development Page
 * Only visible in development mode
 * Shows all Tailwind components and demos for testing
 */

import React, { useState } from "react";

import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";

import { DropdownDemo } from "../../../renderer/tailwind/components/dropdown";
import { ListingDemo } from "../../../renderer/tailwind/components/listing";
import { ButtonDemo } from "../../../renderer/tailwind/components/next/button";
import { CollectionTileDemo } from "../../../renderer/tailwind/components/next/collectiontile";
import {
  InputDemo,
  SelectDemo,
} from "../../../renderer/tailwind/components/next/form";
import { IconDemo } from "../../../renderer/tailwind/components/next/icon";
import {
  TabBar,
  TabButton,
  TabPanel,
  TabProvider,
} from "../../../renderer/tailwind/components/next/tabs";
import { TabsDemo } from "../../../renderer/tailwind/components/next/tabs/TabsDemo";
import { Typography } from "../../../renderer/tailwind/components/next/typography";
import { TypographyDemo } from "../../../renderer/tailwind/components/next/typography/TypographyDemo";
import { PaginationDemo } from "../../../renderer/tailwind/components/pagination";
import { PickerDemo } from "../../../renderer/tailwind/components/picker";
import MainPage from "../../../renderer/views/MainPage";

export const TailwindPage = ({ api }: { api: IExtensionApi }) => {
  const [selectedTab, setSelectedTab] = useState("button");
  const [selectedFormTab, setSelectedFormTab] = useState("input");
  const [selectedDropdownTab, setSelectedDropdownTab] = useState("dropdown");

  return (
    <MainPage id="page-tailwind-dev">
      <MainPage.Body className="h-full overflow-y-auto p-6">
        <div className="space-y-6">
          <div>
            <Typography typographyType="heading-md">Design system</Typography>

            <Typography appearance="subdued" typographyType="body-md">
              This page is only visible in development mode and provides a
              testing ground for design system components.
            </Typography>
          </div>

          <TabProvider
            tab={selectedTab}
            tabListId="tailwind-demo-tabs"
            onSetSelectedTab={setSelectedTab}
          >
            <TabBar>
              <TabButton name="Button" />

              <TabButton name="Typography" />

              <TabButton name="Form" />

              <TabButton name="Tabs" />

              <TabButton name="Icon" />

              <TabButton name="Dropdown" />

              <TabButton name="Listing" />

              <TabButton name="Pagination" />

              <TabButton name="Collection Tile" />
            </TabBar>

            <div className="mt-6">
              <TabPanel name="Button">
                <ButtonDemo />
              </TabPanel>

              <TabPanel name="Typography">
                <TypographyDemo />
              </TabPanel>

              <TabPanel name="Form">
                <TabProvider
                  tab={selectedFormTab}
                  tabListId="form-demo-tabs"
                  tabType="secondary"
                  onSetSelectedTab={setSelectedFormTab}
                >
                  <TabBar>
                    <TabButton name="Input" />

                    <TabButton name="Select" />
                  </TabBar>

                  <div className="mt-6">
                    <TabPanel name="Input">
                      <InputDemo />
                    </TabPanel>

                    <TabPanel name="Select">
                      <SelectDemo />
                    </TabPanel>
                  </div>
                </TabProvider>
              </TabPanel>

              <TabPanel name="Tabs">
                <TabsDemo />
              </TabPanel>

              <TabPanel name="Icon">
                <IconDemo />
              </TabPanel>

              <TabPanel name="Dropdown">
                <TabProvider
                  tab={selectedDropdownTab}
                  tabListId="dropdown-demo-tabs"
                  tabType="secondary"
                  onSetSelectedTab={setSelectedDropdownTab}
                >
                  <TabBar>
                    <TabButton name="Dropdown" />

                    <TabButton name="Picker" />
                  </TabBar>

                  <div className="mt-6">
                    <TabPanel name="Dropdown">
                      <DropdownDemo />
                    </TabPanel>

                    <TabPanel name="Picker">
                      <PickerDemo />
                    </TabPanel>
                  </div>
                </TabProvider>
              </TabPanel>

              <TabPanel name="Listing">
                <ListingDemo />
              </TabPanel>

              <TabPanel name="Pagination">
                <PaginationDemo />
              </TabPanel>

              <TabPanel name="Collection Tile">
                <CollectionTileDemo api={api} />
              </TabPanel>
            </div>
          </TabProvider>
        </div>
      </MainPage.Body>
    </MainPage>
  );
};

export default TailwindPage;
