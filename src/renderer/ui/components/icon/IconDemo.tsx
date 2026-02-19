/**
 * Icon Demo Component
 * Demonstrates the Icon component sizes and accessibility features
 */

import {
  mdiAccount,
  mdiCog,
  mdiDownload,
  mdiHeart,
  mdiMagnify,
  mdiStar,
} from "@mdi/js";
import React from "react";

import {
  nxmCollection,
  nxmDiscord,
  nxmInstall,
  nxmMod,
  nxmRosette,
  nxmVortex,
} from "../../lib/icon_paths";
import { Typography } from "../typography";
import { Icon } from "./Icon";

const mdiIcons = [
  { path: mdiAccount, label: "Account" },
  { path: mdiCog, label: "Settings" },
  { path: mdiDownload, label: "Download" },
  { path: mdiHeart, label: "Favorite" },
  { path: mdiMagnify, label: "Search" },
];

const nxmIcons = [
  { path: nxmVortex, label: "nxmVortex" },
  { path: nxmInstall, label: "nxmInstall" },
  { path: nxmMod, label: "nxmMod" },
  { path: nxmCollection, label: "nxmCollection" },
  { path: nxmRosette, label: "nxmRosette" },
  { path: nxmDiscord, label: "nxmDiscord" },
];

const colorIcons = [
  { path: mdiHeart, label: "Danger", className: "text-danger-strong" },
  { path: mdiStar, label: "Warning", className: "text-warning-strong" },
  { path: mdiDownload, label: "Success", className: "text-success-strong" },
  { path: mdiMagnify, label: "Info", className: "text-info-strong" },
];

export const IconDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Icon
      </Typography>

      <Typography appearance="subdued">
        {`SVG icon component with predefined sizes and accessibility support. Uses the `}

        <span className="font-semibold">@mdi/js</span>

        {` library for standard icons and custom `}

        <span className="font-semibold">nxm*</span>

        {` icon paths for Nexus Mods-specific icons.`}
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Sizes
      </Typography>

      <div className="flex flex-wrap items-end gap-6">
        {(["xs", "sm", "md", "lg", "xl", "2xl"] as const).map((size) => (
          <div className="flex flex-col items-center gap-2" key={size}>
            <Icon path={mdiStar} size={size} />

            <Typography appearance="subdued" typographyType="body-xs">
              {size}
            </Typography>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        With Title (Accessible)
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        When a title is provided, the icon gets role="img" and a {"<title>"}
        element for screen readers.
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        {mdiIcons.map(({ path, label }) => (
          <div className="flex flex-col items-center gap-2" key={label}>
            <Icon path={path} size="lg" title={label} />

            <Typography appearance="subdued" typographyType="body-xs">
              {label}
            </Typography>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Without Title (Decorative)
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        Without a title, the icon gets role="presentation" and is hidden from
        screen readers.
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        {mdiIcons.map(({ path, label }) => (
          <Icon key={label} path={path} size="lg" />
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Custom NXM Icons
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        Custom Nexus Mods icons from the icon-paths library, prefixed with nxm.
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        {nxmIcons.map(({ path, label }) => (
          <div className="flex flex-col items-center gap-2" key={label}>
            <Icon path={path} size="lg" title={label} />

            <Typography appearance="subdued" typographyType="body-xs">
              {label}
            </Typography>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Custom Colors
      </Typography>

      <div className="flex flex-wrap items-center gap-6">
        {colorIcons.map(({ path, label, className }) => (
          <Icon className={className} key={label} path={path} size="xl" />
        ))}
      </div>
    </div>
  </div>
);
