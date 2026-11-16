/**
 * Design System Development Page
 * Only visible in development mode
 * Shows all design system components and demos for testing
 */

import React, { type ComponentType, useState } from "react";

import { AlertDemo } from "@/ui/components/alert/Alert.demo";
import { BadgesDemo } from "@/ui/components/badges/Badges.demo";
import { BulletDemo } from "@/ui/components/bullet/Bullet.demo";
import { ButtonDemo } from "@/ui/components/button/Button.demo";
import { ContextMenuDemo } from "@/ui/components/context_menu/ContextMenu.demo";
import { DropdownDemo } from "@/ui/components/dropdown/Dropdown.demo";
import { FeedbackModalDemo } from "@/ui/components/feedback_modal/FeedbackModal.demo";
import { FileTreeDemo } from "@/ui/components/file_tree/FileTree.demo";
import { CheckboxFieldDemo } from "@/ui/components/form/checkbox_field/CheckboxField.demo";
import { RadioGroupFieldDemo } from "@/ui/components/form/radio_group_field/RadioGroupField.demo";
import { SelectFieldDemo } from "@/ui/components/form/select_field/SelectField.demo";
import { SwitchFieldDemo } from "@/ui/components/form/switch_field/SwitchField.demo";
import { TextAreaFieldDemo } from "@/ui/components/form/text_area_field/TextAreaField.demo";
import { TextFieldDemo } from "@/ui/components/form/text_field/TextField.demo";
import { HoverCardDemo } from "@/ui/components/hover_card/HoverCard.demo";
import { IconDemo } from "@/ui/components/icon/Icon.demo";
import { ImageDemo } from "@/ui/components/image/Image.demo";
import { ListingDemo } from "@/ui/components/listing/Listing.demo";
import { MessageBoxDemo } from "@/ui/components/message_box/MessageBox.demo";
import { ModalDemo } from "@/ui/components/modal/Modal.demo";
import { NoResultsDemo } from "@/ui/components/no_results/NoResults.demo";
import { PaginationDemo } from "@/ui/components/pagination/Pagination.demo";
import { PickerDemo } from "@/ui/components/picker/Picker.demo";
import { PillDemo } from "@/ui/components/pill/Pill.demo";
import { PopoverDemo } from "@/ui/components/popover/Popover.demo";
import { ProseDemo } from "@/ui/components/prose/Prose.demo";
import { SearchDemo } from "@/ui/components/search/Search.demo";
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

/** One component's demo, as a sub-tab of its group. */
interface IDemo {
  /** Its tab's id, unique in its group. */
  id: string;
  /** Its tab's name. */
  name: string;
  /** The demo to show. */
  Demo: ComponentType;
}

/** A group of related components' demos, as a top-level tab. */
interface IDemoGroup {
  /** Its tab's id. */
  id: string;
  /** Its tab's name. */
  name: string;
  /** Its demos, as sub-tabs, the first shown to begin with. */
  demos: IDemo[];
}

/** The demos, grouped by what the components are for. */
const DEMO_GROUPS: IDemoGroup[] = [
  {
    id: "actions",
    name: "Actions",
    demos: [
      { id: "button", name: "Button", Demo: ButtonDemo },
      { id: "split-button", name: "Split button", Demo: SplitButtonDemo },
      { id: "view-picker", name: "View picker", Demo: ViewPickerDemo },
      { id: "toolbar", name: "Toolbar", Demo: ToolbarDemo },
    ],
  },
  {
    id: "text",
    name: "Text",
    demos: [
      { id: "typography", name: "Typography", Demo: TypographyDemo },
      { id: "link", name: "Link", Demo: TypographyLinkDemo },
      { id: "prose", name: "Prose", Demo: ProseDemo },
      { id: "bullet", name: "Bullet", Demo: BulletDemo },
    ],
  },
  {
    id: "forms",
    name: "Forms",
    demos: [
      { id: "text-field", name: "Text field", Demo: TextFieldDemo },
      { id: "select-field", name: "Select field", Demo: SelectFieldDemo },
      { id: "checkbox-field", name: "Checkbox field", Demo: CheckboxFieldDemo },
      { id: "switch-field", name: "Switch field", Demo: SwitchFieldDemo },
      { id: "radio-group-field", name: "Radio group field", Demo: RadioGroupFieldDemo },
      { id: "text-area-field", name: "Text area field", Demo: TextAreaFieldDemo },
      { id: "search", name: "Search", Demo: SearchDemo },
    ],
  },
  {
    id: "navigation",
    name: "Navigation",
    demos: [
      { id: "tabs", name: "Tabs", Demo: TabsDemo },
      { id: "pagination", name: "Pagination", Demo: PaginationDemo },
    ],
  },
  {
    id: "overlays",
    name: "Overlays",
    demos: [
      { id: "dropdown", name: "Dropdown", Demo: DropdownDemo },
      { id: "picker", name: "Picker", Demo: PickerDemo },
      { id: "popover", name: "Popover", Demo: PopoverDemo },
      { id: "context-menu", name: "Context menu", Demo: ContextMenuDemo },
      { id: "tooltip", name: "Tooltip", Demo: TooltipDemo },
      { id: "hover-card", name: "Hover card", Demo: HoverCardDemo },
      { id: "modal", name: "Modal", Demo: ModalDemo },
      { id: "feedback-modal", name: "FeedbackModal", Demo: FeedbackModalDemo },
    ],
  },
  {
    id: "media",
    name: "Media",
    demos: [
      { id: "icon", name: "Icon", Demo: IconDemo },
      { id: "image", name: "Image", Demo: ImageDemo },
    ],
  },
  {
    id: "labels",
    name: "Labels",
    demos: [
      { id: "pill", name: "Pill", Demo: PillDemo },
      { id: "badges", name: "Badges", Demo: BadgesDemo },
    ],
  },
  {
    id: "data",
    name: "Data",
    demos: [
      { id: "listing", name: "Listing", Demo: ListingDemo },
      { id: "no-results", name: "No results", Demo: NoResultsDemo },
      { id: "table", name: "Table", Demo: TableDemo },
      { id: "file-tree", name: "File tree", Demo: FileTreeDemo },
    ],
  },
  {
    id: "feedback",
    name: "Feedback",
    demos: [
      { id: "alert", name: "Alert", Demo: AlertDemo },
      { id: "message-box", name: "Message box", Demo: MessageBoxDemo },
    ],
  },
];

interface IDemoGroupProps {
  /** The group whose demos to show. */
  group: IDemoGroup;
  /** The open demo's id; none for the group's first. */
  selected?: string;
  /** Opens another of its demos, by id. */
  onSelect: (id: string) => void;
}

/** A group's demos, a sub-tab each. */
const DemoGroup = ({ group, selected, onSelect }: IDemoGroupProps) => (
  <TabProvider
    tab={selected ?? group.demos[0].id}
    tabListId={`${group.id}-demo-tabs`}
    tabType="secondary"
    onSetSelectedTab={onSelect}
  >
    <TabBar>
      {group.demos.map(({ id, name }) => (
        <TabButton key={id} name={name} panelId={id} />
      ))}
    </TabBar>

    <div className="mt-6">
      {group.demos.map(({ id, Demo }) => (
        <TabPanel id={id} key={id}>
          <Demo />
        </TabPanel>
      ))}
    </div>
  </TabProvider>
);

interface IDesignSystemPageProps {
  /** Whether the page is the one showing, which its `Page` needs. */
  active?: boolean;
}

export const DesignSystemPage = ({ active }: IDesignSystemPageProps) => {
  const [selectedTab, setSelectedTab] = useState(DEMO_GROUPS[0].id);
  const [selectedDemos, setSelectedDemos] = useState<Record<string, string>>({});

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
            {DEMO_GROUPS.map(({ id, name }) => (
              <TabButton key={id} name={name} panelId={id} />
            ))}
          </TabBar>

          <div className="mt-6">
            {DEMO_GROUPS.map((group) => (
              <TabPanel id={group.id} key={group.id}>
                <DemoGroup
                  group={group}
                  selected={selectedDemos[group.id]}
                  onSelect={(id) =>
                    setSelectedDemos((previous) => ({ ...previous, [group.id]: id }))
                  }
                />
              </TabPanel>
            ))}
          </div>
        </TabProvider>
      </PageScroll>
    </Page>
  );
};

export default DesignSystemPage;
