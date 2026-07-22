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
import { TypographyDemo } from "@/ui/components/typography/Typography.demo";
import { TypographyLinkDemo } from "@/ui/components/typography/TypographyLink.demo";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

export const DesignSystemPage = ({ active, api }: { active?: boolean; api: IExtensionApi }) => {
  const [selectedTab, setSelectedTab] = useState("button");
  const [selectedTypographyTab, setSelectedTypographyTab] = useState("typography");
  const [selectedIconTab, setSelectedIconTab] = useState("icon");
  const [selectedFormTab, setSelectedFormTab] = useState("input");
  const [selectedDropdownTab, setSelectedDropdownTab] = useState("dropdown");

  return (
    <Page active={active} id="page-design-system-dev" scrollable={false}>
      <PageHeader
        pictogramName="tools"
        subtitle="This page is only visible in development mode and provides a testing ground for design system components."
        title="Design system"
      />

      <PageScroll className="space-y-6 p-6">
        <TabProvider
          tab={selectedTab}
          tabListId="design-system-demo-tabs"
          onSetSelectedTab={setSelectedTab}
        >
          <TabBar>
            <TabButton name="Button" panelId="button" />

            <TabButton name="Pill" panelId="pill" />

            <TabButton name="Typography" panelId="typography" />

            <TabButton name="Form" panelId="form" />

            <TabButton name="Tabs" panelId="tabs" />

            <TabButton name="Icon" panelId="icon" />

            <TabButton name="Image" panelId="image" />

            <TabButton name="Dropdown" panelId="dropdown" />

            <TabButton name="Listing" panelId="listing" />

            <TabButton name="Pagination" panelId="pagination" />

            <TabButton name="Table" panelId="table" />

            <TabButton name="Collection Tile" panelId="collection-tile" />

            <TabButton name="Toolbar" panelId="toolbar" />
          </TabBar>

          <div className="mt-6">
            <TabPanel id="button">
              <ButtonDemo />
            </TabPanel>

            <TabPanel id="pill">
              <PillDemo />
            </TabPanel>

            <TabPanel id="typography">
              <TabProvider
                tab={selectedTypographyTab}
                tabListId="typography-demo-tabs"
                tabType="secondary"
                onSetSelectedTab={setSelectedTypographyTab}
              >
                <TabBar>
                  <TabButton name="Typography" panelId="typography" />

                  <TabButton name="Link" panelId="link" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="typography">
                    <TypographyDemo />
                  </TabPanel>

                  <TabPanel id="link">
                    <TypographyLinkDemo />
                  </TabPanel>
                </div>
              </TabProvider>
            </TabPanel>

            <TabPanel id="form">
              <TabProvider
                tab={selectedFormTab}
                tabListId="form-demo-tabs"
                tabType="secondary"
                onSetSelectedTab={setSelectedFormTab}
              >
                <TabBar>
                  <TabButton name="Input" panelId="input" />

                  <TabButton name="Select" panelId="select" />

                  <TabButton name="Switch" panelId="switch" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="input">
                    <InputDemo />
                  </TabPanel>

                  <TabPanel id="select">
                    <SelectDemo />
                  </TabPanel>

                  <TabPanel id="switch">
                    <SwitchDemo />
                  </TabPanel>
                </div>
              </TabProvider>
            </TabPanel>

            <TabPanel id="tabs">
              <TabsDemo />
            </TabPanel>

            <TabPanel id="icon">
              <TabProvider
                tab={selectedIconTab}
                tabListId="icon-demo-tabs"
                tabType="secondary"
                onSetSelectedTab={setSelectedIconTab}
              >
                <TabBar>
                  <TabButton name="Icon" panelId="icon" />

                  <TabButton name="Premium Badge" panelId="premium-badge" />

                  <TabButton name="Bullet" panelId="bullet" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="icon">
                    <IconDemo />
                  </TabPanel>

                  <TabPanel id="premium-badge">
                    <PremiumBadgeDemo />
                  </TabPanel>

                  <TabPanel id="bullet">
                    <BulletDemo />
                  </TabPanel>
                </div>
              </TabProvider>
            </TabPanel>

            <TabPanel id="image">
              <ImageDemo />
            </TabPanel>

            <TabPanel id="dropdown">
              <TabProvider
                tab={selectedDropdownTab}
                tabListId="dropdown-demo-tabs"
                tabType="secondary"
                onSetSelectedTab={setSelectedDropdownTab}
              >
                <TabBar>
                  <TabButton name="Dropdown" panelId="dropdown" />

                  <TabButton name="Picker" panelId="picker" />

                  <TabButton name="Popover" panelId="popover" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="dropdown">
                    <DropdownDemo />
                  </TabPanel>

                  <TabPanel id="picker">
                    <PickerDemo />
                  </TabPanel>

                  <TabPanel id="popover">
                    <PopoverDemo />
                  </TabPanel>
                </div>
              </TabProvider>
            </TabPanel>

            <TabPanel id="listing">
              <ListingDemo />
            </TabPanel>

            <TabPanel id="pagination">
              <PaginationDemo />
            </TabPanel>

            <TabPanel id="table">
              <TableDemo />
            </TabPanel>

            <TabPanel id="collection-tile">
              <CollectionTileDemo api={api} />
            </TabPanel>

            <TabPanel id="toolbar">
              <ToolbarDemo />
            </TabPanel>
          </div>
        </TabProvider>
      </PageScroll>
    </Page>
  );
};

export default DesignSystemPage;
