/**
 * Icon Demo Component
 * Demonstrates the Icon component sizes and accessibility features
 */

import { mdiAccount, mdiCog, mdiDownload, mdiHeart, mdiMagnify, mdiStar } from "@mdi/js";
import React from "react";

import { Typography } from "@/ui/components/typography/Typography";
import {
  nxmCollection,
  nxmDiscord,
  nxmInstall,
  nxmMod,
  nxmRosette,
  nxmVortex,
} from "@/ui/icon-paths";

import { Icon } from "./Icon";

const mdiIcons = [
  { path: mdiAccount, label: "Account" },
  { path: mdiCog, label: "Settings" },
  { path: mdiDownload, label: "Download" },
  { path: mdiHeart, label: "Favorite" },
  { path: mdiMagnify, label: "Search" },
];

const symbols = [
  { name: "person", label: "Account" },
  { name: "settings", label: "Settings" },
  { name: "download", label: "Download" },
  { name: "favorite", label: "Favorite" },
  { name: "search", label: "Search" },
  { name: "rule", label: "Rules" },
] as const;

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
        Material Symbols
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        {`Pass a symbol's `}

        <span className="font-semibold">name</span>

        {` instead of a path to draw it from the variable font. The same sizes apply, and `}

        <span className="font-semibold">fill</span>

        {`, `}

        <span className="font-semibold">weight</span>

        {`, `}

        <span className="font-semibold">grade</span>

        {` and `}

        <span className="font-semibold">opticalSize</span>

        {` set the font's axes.`}
      </Typography>

      <div className="flex flex-wrap items-end gap-6">
        {symbols.map(({ name, label }) => (
          <div className="flex flex-col items-center gap-2" key={name}>
            <Icon name={name} size="lg" title={label} />

            <Typography appearance="subdued" typographyType="body-xs">
              {name}
            </Typography>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        {([false, true] as const).map((fill) => (
          <div className="flex flex-col items-center gap-2" key={String(fill)}>
            <Icon fill={fill} name="star" size="xl" />

            <Typography appearance="subdued" typographyType="body-xs">
              {fill ? "fill" : "outline"}
            </Typography>
          </div>
        ))}

        {([100, 400, 700] as const).map((weight) => (
          <div className="flex flex-col items-center gap-2" key={weight}>
            <Icon name="settings" size="xl" weight={weight} />

            <Typography appearance="subdued" typographyType="body-xs">
              {`weight ${weight}`}
            </Typography>
          </div>
        ))}

        {([20, 24, 48] as const).map((opticalSize) => (
          <div className="flex flex-col items-center gap-2" key={opticalSize}>
            <Icon name="settings" opticalSize={opticalSize} size="xl" />

            <Typography appearance="subdued" typographyType="body-xs">
              {`optical size ${opticalSize}`}
            </Typography>
          </div>
        ))}

        {([-25, 0, 200] as const).map((grade) => (
          <div className="flex flex-col items-center gap-2" key={grade}>
            <Icon grade={grade} name="settings" size="xl" />

            <Typography appearance="subdued" typographyType="body-xs">
              {`grade ${grade}`}
            </Typography>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-6">
        {(["xs", "sm", "md", "lg", "xl", "2xl"] as const).map((size) => (
          <div className="flex flex-col items-center gap-2" key={size}>
            <Icon name="download" size={size} />

            <Typography appearance="subdued" typographyType="body-xs">
              {size}
            </Typography>
          </div>
        ))}
      </div>
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
        Without a title, the icon gets role="presentation" and is hidden from screen readers.
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
