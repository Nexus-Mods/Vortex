/**
 * Toolbar Demo Component
 * Demonstrates the Toolbar / ToolbarGroup layout with icon-only buttons.
 */

import {
  mdiCallMerge,
  mdiCheck,
  mdiClose,
  mdiCloudDownloadOutline,
  mdiDeleteOutline,
  mdiEyeOutline,
  mdiFolderOpenOutline,
  mdiHistory,
  mdiLabelOutline,
  mdiPaw,
  mdiPawOutline,
  mdiPlaylistCheck,
  mdiPlusCircleOutline,
  mdiRefresh,
} from "@mdi/js";
import React from "react";

import { Typography } from "@/ui/components/typography/Typography";

import { Toolbar } from "./Toolbar";
import { type IToolbarAction, ToolbarGroup } from "./ToolbarGroup";

const generalActions: IToolbarAction[] = [
  { label: "Install mod", iconPath: mdiPlusCircleOutline },
  { label: "Open mods folder", iconPath: mdiFolderOpenOutline },
  { label: "History", iconPath: mdiHistory },
  { label: "Refresh", iconPath: mdiRefresh },
  { label: "Categories", iconPath: mdiLabelOutline },
  { label: "Manage rules", iconPath: mdiPlaylistCheck },
];

const contextualActions: IToolbarAction[] = [
  { label: "1 selected", iconPath: mdiClose, showLabel: true },
  { label: "Remove", iconPath: mdiDeleteOutline },
  { label: "Refresh", iconPath: mdiRefresh },
  { label: "Download updates", iconPath: mdiCloudDownloadOutline, brand: "info" },
  { label: "Enable", iconPath: mdiCheck },
  { label: "Disable", iconPath: mdiClose },
];

// More than `maxVisible` (7) actions: the first six render as buttons and the
// rest collapse into the trailing kebab dropdown.
const overflowActions: IToolbarAction[] = [
  ...generalActions,
  { label: "Combine", iconPath: mdiCallMerge },
  { label: "Highlight", iconPath: mdiEyeOutline },
  { label: "Track", iconPath: mdiPaw },
  { label: "Untrack", iconPath: mdiPawOutline },
];

export const ToolbarDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Toolbar
      </Typography>

      <Typography appearance="subdued">
        A horizontal toolbar made of one or more rounded groups of related controls. Groups share a
        raised surface; controls are typically icon-only buttons.
      </Typography>
    </div>

    <Toolbar>
      <ToolbarGroup actions={generalActions} />

      <ToolbarGroup actions={contextualActions} />
    </Toolbar>

    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        Overflow
      </Typography>

      <Typography appearance="subdued">
        When a group has more than <code>maxVisible</code> (7) actions, the trailing slot becomes a
        kebab menu and the remaining actions move into its dropdown.
      </Typography>
    </div>

    <Toolbar>
      <ToolbarGroup actions={overflowActions} />
    </Toolbar>
  </div>
);
