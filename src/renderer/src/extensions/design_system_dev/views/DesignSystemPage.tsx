/**
 * Design System Development Page
 * Only visible in development mode
 * Shows all design system components and demos for testing
 */

import React, { useState } from "react";

import { AlertDemo } from "@/ui/components/alert/Alert.demo";
import { BadgesDemo } from "@/ui/components/badges/Badges.demo";
import { BulletDemo } from "@/ui/components/bullet/Bullet.demo";
import { ButtonDemo } from "@/ui/components/button/Button.demo";
import { ContextMenuDemo } from "@/ui/components/context_menu/ContextMenu.demo";
import { DropdownDemo } from "@/ui/components/dropdown/Dropdown.demo";
import { FileTreeDemo } from "@/ui/components/file_tree/FileTree.demo";
import { CheckboxFieldDemo } from "@/ui/components/form/checkbox_field/CheckboxField.demo";
import { RadioGroupFieldDemo } from "@/ui/components/form/radio_group_field/RadioGroupField.demo";
import { SelectFieldDemo } from "@/ui/components/form/select_field/SelectField.demo";
import { SwitchFieldDemo } from "@/ui/components/form/switch_field/SwitchField.demo";
import { TextAreaFieldDemo } from "@/ui/components/form/text_area_field/TextAreaField.demo";
import { TextFieldDemo } from "@/ui/components/form/text_field/TextField.demo";
import { GameTileDemo } from "@/ui/components/game_tile/GameTile.demo";
import { HoverCardDemo } from "@/ui/components/hover_card/HoverCard.demo";
import { IconDemo } from "@/ui/components/icon/Icon.demo";
import { ImageDemo } from "@/ui/components/image/Image.demo";
import { ListingDemo } from "@/ui/components/listing/Listing.demo";
import { MessageBoxDemo } from "@/ui/components/message_box/MessageBox.demo";
import { PaginationDemo } from "@/ui/components/pagination/Pagination.demo";
import { PickerDemo } from "@/ui/components/picker/Picker.demo";
import { PillDemo } from "@/ui/components/pill/Pill.demo";
import { PopoverDemo } from "@/ui/components/popover/Popover.demo";
import { SplitButtonDemo } from "@/ui/components/split_button/SplitButton.demo";
import { TableDemo } from "@/ui/components/table/Table.demo";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { TabsDemo } from "@/ui/components/tabs/Tabs.demo";
import { ToolbarDemo } from "@/ui/components/toolbar/Toolbar.demo";
import { TooltipDemo } from "@/ui/components/tooltip/Tooltip.demo";
import { TypographyDemo } from "@/ui/components/typography/Typography.demo";
import { TypographyLinkDemo } from "@/ui/components/typography/TypographyLink.demo";
import { ViewPickerDemo } from "@/ui/components/view_picker/ViewPicker.demo";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

interface IDesignSystemPageProps {
  /** Whether the page is the one showing, which its `Page` needs. */
  active?: boolean;
}

export const DesignSystemPage = ({ active }: IDesignSystemPageProps) => {
  const [selectedTab, setSelectedTab] = useState("button");
  const [selectedButtonTab, setSelectedButtonTab] = useState("buttons");
  const [selectedTypographyTab, setSelectedTypographyTab] = useState("typography");
  const [selectedIconTab, setSelectedIconTab] = useState("icon");
  const [selectedFormTab, setSelectedFormTab] = useState("text-field");
  const [selectedDropdownTab, setSelectedDropdownTab] = useState("dropdown");
  const [selectedTooltipTab, setSelectedTooltipTab] = useState("tooltip-basic");

  return (
    <Page active={active} id="page-design-system-dev" scrollable={false}>
      <PageHeader
        pictogramName="tools"
        subtitle="This page is only visible in development mode and provides a testing ground for design system components."
        title="Design system"
      />

      <PageScroll className="space-y-6 p-6">
        <TabProvider
          hasBorder
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

            <TabButton name="File tree" panelId="file-tree" />

            <TabButton name="Listing" panelId="listing" />

            <TabButton name="Pagination" panelId="pagination" />

            <TabButton name="Table" panelId="table" />

            <TabButton name="Tile" panelId="tile" />

            <TabButton name="Toolbar" panelId="toolbar" />

            <TabButton name="Tooltip" panelId="tooltip" />

            <TabButton name="Alert" panelId="alert" />
            <TabButton name="Message box" panelId="message-box" />
          </TabBar>

          <div className="mt-6">
            <TabPanel id="button">
              <TabProvider
                tab={selectedButtonTab}
                tabListId="button-demo-tabs"
                tabType="secondary"
                onSetSelectedTab={setSelectedButtonTab}
              >
                <TabBar>
                  <TabButton name="Button" panelId="buttons" />

                  <TabButton name="Split button" panelId="split-button" />

                  <TabButton name="View picker" panelId="view-picker" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="buttons">
                    <ButtonDemo />
                  </TabPanel>

                  <TabPanel id="split-button">
                    <SplitButtonDemo />
                  </TabPanel>

                  <TabPanel id="view-picker">
                    <ViewPickerDemo />
                  </TabPanel>
                </div>
              </TabProvider>
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
                  <TabButton name="Text field" panelId="text-field" />

                  <TabButton name="Select field" panelId="select-field" />

                  <TabButton name="Checkbox field" panelId="checkbox-field" />

                  <TabButton name="Switch field" panelId="switch-field" />

                  <TabButton name="Radio group field" panelId="radio-group-field" />

                  <TabButton name="Text area field" panelId="text-area-field" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="text-field">
                    <TextFieldDemo />
                  </TabPanel>

                  <TabPanel id="select-field">
                    <SelectFieldDemo />
                  </TabPanel>

                  <TabPanel id="checkbox-field">
                    <CheckboxFieldDemo />
                  </TabPanel>

                  <TabPanel id="switch-field">
                    <SwitchFieldDemo />
                  </TabPanel>

                  <TabPanel id="radio-group-field">
                    <RadioGroupFieldDemo />
                  </TabPanel>

                  <TabPanel id="text-area-field">
                    <TextAreaFieldDemo />
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

                  <TabButton name="Badges" panelId="badges" />

                  <TabButton name="Bullet" panelId="bullet" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="icon">
                    <IconDemo />
                  </TabPanel>

                  <TabPanel id="badges">
                    <BadgesDemo />
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

                  <TabButton name="Context menu" panelId="context-menu" />
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

                  <TabPanel id="context-menu">
                    <ContextMenuDemo />
                  </TabPanel>
                </div>
              </TabProvider>
            </TabPanel>

            <TabPanel id="listing">
              <ListingDemo />
            </TabPanel>

            <TabPanel id="file-tree">
              <FileTreeDemo />
            </TabPanel>

            <TabPanel id="pagination">
              <PaginationDemo />
            </TabPanel>

            <TabPanel id="table">
              <TableDemo />
            </TabPanel>

            <TabPanel id="tile">
              <GameTileDemo />
            </TabPanel>

            <TabPanel id="toolbar">
              <ToolbarDemo />
            </TabPanel>

            <TabPanel id="tooltip">
              <TabProvider
                tab={selectedTooltipTab}
                tabListId="tooltip-demo-tabs"
                tabType="secondary"
                onSetSelectedTab={setSelectedTooltipTab}
              >
                <TabBar>
                  <TabButton name="Tooltip" panelId="tooltip-basic" />

                  <TabButton name="Hover card" panelId="hover-card" />
                </TabBar>

                <div className="mt-6">
                  <TabPanel id="tooltip-basic">
                    <TooltipDemo />
                  </TabPanel>

                  <TabPanel id="hover-card">
                    <HoverCardDemo />
                  </TabPanel>
                </div>
              </TabProvider>
            </TabPanel>

            <TabPanel id="alert">
              <AlertDemo />
            </TabPanel>

            <TabPanel id="message-box">
              <MessageBoxDemo />
            </TabPanel>
          </div>
        </TabProvider>
      </PageScroll>
    </Page>
  );
};

export default DesignSystemPage;
