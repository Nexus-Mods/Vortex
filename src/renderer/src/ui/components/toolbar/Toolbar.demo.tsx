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

// Ten actions, used below to show both limits: a `maxVisible` slot cap, and the
// width of the toolbar itself.
const manyActions: IToolbarAction[] = [
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
        Passing <code>maxVisible</code> caps how many slots a group ever uses. Past that, the
        trailing slot becomes a kebab menu and the remaining actions move into its dropdown.
      </Typography>
    </div>

    <Toolbar>
      <ToolbarGroup actions={manyActions} maxVisible={7} />
    </Toolbar>

    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        Responsive
      </Typography>

      <Typography appearance="subdued">
        A group also collapses whatever won't fit the width the toolbar has, so the same actions
        stay reachable as the window narrows. Drag the bottom-right corner of the box below to
        resize it. This group has no <code>maxVisible</code> cap, leaving width as the only limit.
      </Typography>
    </div>

    {/* `resize` needs a non-visible overflow, so the box is padded low enough for
        an opened overflow menu to sit inside it rather than being clipped. */}
    <div className="w-104 resize-x overflow-auto rounded-sm border border-stroke-weak px-2 pt-2 pb-40">
      <Toolbar>
        <ToolbarGroup actions={manyActions} />
      </Toolbar>
    </div>

    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        Competing groups
      </Typography>

      <Typography appearance="subdued">
        When several groups share a toolbar, the earlier ones keep their controls and the later ones
        collapse first, so the leading group stays stable as space runs out. Every group holds onto
        its own overflow menu, and each reserves room for the ones after it, so the row never
        overflows. Resize the box below to watch the second group give way before the first.
      </Typography>
    </div>

    <div className="w-104 resize-x overflow-auto rounded-sm border border-stroke-weak px-2 pt-2 pb-40">
      <Toolbar>
        <ToolbarGroup actions={generalActions} />

        <ToolbarGroup actions={contextualActions} />
      </Toolbar>
    </div>
  </div>
);
