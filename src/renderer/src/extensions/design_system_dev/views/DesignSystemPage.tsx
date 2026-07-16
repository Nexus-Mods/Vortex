/**
 * Design System Development Page
 * Only visible in development mode
 * Shows all design system components and demos for testing
 */

import React, { useState } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { BulletDemo } from "@/ui/components/bullet/Bullet.demo";
import { ButtonDemo } from "@/ui/components/button/Button.demo";
import { CollectionTileDemo } from "@/ui/components/collection_tile/CollectionTile.demo";
import { DropdownDemo } from "@/ui/components/dropdown/Dropdown.demo";
import { InputDemo } from "@/ui/components/form/input/Input.demo";
import { SelectDemo } from "@/ui/components/form/select/Select.demo";
import { SwitchDemo } from "@/ui/components/form/switch/Switch.demo";
import { IconDemo } from "@/ui/components/icon/Icon.demo";
import { ImageDemo } from "@/ui/components/image/Image.demo";
import { ListingDemo } from "@/ui/components/listing/Listing.demo";
import { PaginationDemo } from "@/ui/components/pagination/Pagination.demo";
import { PickerDemo } from "@/ui/components/picker/Picker.demo";
import { PillDemo } from "@/ui/components/pill/Pill.demo";
import { PopoverDemo } from "@/ui/components/popover/Popover.demo";
import { PremiumBadgeDemo } from "@/ui/components/premium_badge/PremiumBadge.demo";
import { TableDemo } from "@/ui/components/table/Table.demo";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { TabsDemo } from "@/ui/components/tabs/Tabs.demo";
import { ToolbarDemo } from "@/ui/components/toolbar/Toolbar.demo";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyDemo } from "@/ui/components/typography/Typography.demo";
import { TypographyLinkDemo } from "@/ui/components/typography/TypographyLink.demo";
import PageRoot from "@/views/PageRoot";

export const DesignSystemPage = ({ active, api }: { active?: boolean; api: IExtensionApi }) => {
  const [selectedTab, setSelectedTab] = useState("button");
  const [selectedTypographyTab, setSelectedTypographyTab] = useState("typography");
  const [selectedIconTab, setSelectedIconTab] = useState("icon");
  const [selectedFormTab, setSelectedFormTab] = useState("input");
  const [selectedDropdownTab, setSelectedDropdownTab] = useState("dropdown");

  return (
    <PageRoot active={active} className="space-y-6 p-6" id="page-design-system-dev">
      <div>
        <Typography typographyType="heading-md">Design system</Typography>

        <Typography appearance="subdued" typographyType="body-md">
          This page is only visible in development mode and provides a testing ground for design
          system components.
        </Typography>
      </div>

      <TabProvider
        tab={selectedTab}
        tabListId="design-system-demo-tabs"
        onSetSelectedTab={setSelectedTab}
      >
        <TabBar>
          <TabButton name="Button" />

          <TabButton name="Pill" />

          <TabButton name="Typography" />

          <TabButton name="Form" />

          <TabButton name="Tabs" />

          <TabButton name="Icon" />

          <TabButton name="Image" />

          <TabButton name="Dropdown" />

          <TabButton name="Listing" />

          <TabButton name="Pagination" />

          <TabButton name="Table" />

          <TabButton name="Collection Tile" />

          <TabButton name="Toolbar" />
        </TabBar>

        <div className="mt-6">
          <TabPanel name="Button">
            <ButtonDemo />
          </TabPanel>

          <TabPanel name="Pill">
            <PillDemo />
          </TabPanel>

          <TabPanel name="Typography">
            <TabProvider
              tab={selectedTypographyTab}
              tabListId="typography-demo-tabs"
              tabType="secondary"
              onSetSelectedTab={setSelectedTypographyTab}
            >
              <TabBar>
                <TabButton name="Typography" />

                <TabButton name="Link" />
              </TabBar>

              <div className="mt-6">
                <TabPanel name="Typography">
                  <TypographyDemo />
                </TabPanel>

                <TabPanel name="Link">
                  <TypographyLinkDemo />
                </TabPanel>
              </div>
            </TabProvider>
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

                <TabButton name="Switch" />
              </TabBar>

              <div className="mt-6">
                <TabPanel name="Input">
                  <InputDemo />
                </TabPanel>

                <TabPanel name="Select">
                  <SelectDemo />
                </TabPanel>

                <TabPanel name="Switch">
                  <SwitchDemo />
                </TabPanel>
              </div>
            </TabProvider>
          </TabPanel>

          <TabPanel name="Tabs">
            <TabsDemo />
          </TabPanel>

          <TabPanel name="Icon">
            <TabProvider
              tab={selectedIconTab}
              tabListId="icon-demo-tabs"
              tabType="secondary"
              onSetSelectedTab={setSelectedIconTab}
            >
              <TabBar>
                <TabButton name="Icon" />

                <TabButton name="Premium Badge" />

                <TabButton name="Bullet" />
              </TabBar>

              <div className="mt-6">
                <TabPanel name="Icon">
                  <IconDemo />
                </TabPanel>

                <TabPanel name="Premium Badge">
                  <PremiumBadgeDemo />
                </TabPanel>

                <TabPanel name="Bullet">
                  <BulletDemo />
                </TabPanel>
              </div>
            </TabProvider>
          </TabPanel>

          <TabPanel name="Image">
            <ImageDemo />
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

                <TabButton name="Popover" />
              </TabBar>

              <div className="mt-6">
                <TabPanel name="Dropdown">
                  <DropdownDemo />
                </TabPanel>

                <TabPanel name="Picker">
                  <PickerDemo />
                </TabPanel>

                <TabPanel name="Popover">
                  <PopoverDemo />
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

          <TabPanel name="Table">
            <TableDemo />
          </TabPanel>

          <TabPanel name="Collection Tile">
            <CollectionTileDemo api={api} />
          </TabPanel>

          <TabPanel name="Toolbar">
            <ToolbarDemo />
          </TabPanel>
        </div>
      </TabProvider>
    </PageRoot>
  );
};

export default DesignSystemPage;
