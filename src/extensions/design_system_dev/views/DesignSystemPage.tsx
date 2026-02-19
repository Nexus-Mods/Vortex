/**
 * Design System Development Page
 * Only visible in development mode
 * Shows all design system components and demos for testing
 */

import React, { useState } from "react";

import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";

import { ButtonDemo } from "../../../renderer/ui/components/button/ButtonDemo";
import { CollectionTileDemo } from "../../../renderer/ui/components/collectiontile/CollectionTileDemo";
import { DropdownDemo } from "../../../renderer/ui/components/dropdown/DropdownDemo";
import { InputDemo } from "../../../renderer/ui/components/form/input/InputDemo";
import { SelectDemo } from "../../../renderer/ui/components/form/select/SelectDemo";
import { IconDemo } from "../../../renderer/ui/components/icon/IconDemo";
import { ListingDemo } from "../../../renderer/ui/components/listing/ListingDemo";
import { PaginationDemo } from "../../../renderer/ui/components/pagination/PaginationDemo";
import { PickerDemo } from "../../../renderer/ui/components/picker/PickerDemo";
import { TabButton } from "../../../renderer/ui/components/tabs/Tab";
import { TabBar } from "../../../renderer/ui/components/tabs/TabBar";
import { TabPanel } from "../../../renderer/ui/components/tabs/TabPanel";
import { TabProvider } from "../../../renderer/ui/components/tabs/tabs.context";
import { TabsDemo } from "../../../renderer/ui/components/tabs/TabsDemo";
import { Typography } from "../../../renderer/ui/components/typography/Typography";
import { TypographyDemo } from "../../../renderer/ui/components/typography/TypographyDemo";
import MainPage from "../../../renderer/views/MainPage";

export const DesignSystemPage = ({ api }: { api: IExtensionApi }) => {
  const [selectedTab, setSelectedTab] = useState("button");
  const [selectedFormTab, setSelectedFormTab] = useState("input");
  const [selectedDropdownTab, setSelectedDropdownTab] = useState("dropdown");

  return (
    <MainPage id="page-design-system-dev">
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
            tabListId="design-system-demo-tabs"
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

export default DesignSystemPage;
