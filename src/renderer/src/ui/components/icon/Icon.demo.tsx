/**
 * Icon Demo Component
 * Demonstrates the Icon component sizes and accessibility features
 */

import React from "react";

import { Image } from "@/ui/components/image/Image";
import { Typography } from "@/ui/components/typography/Typography";
import { nxmCollection, nxmDiscord, nxmMod, nxmModOutline, nxmVortex } from "@/ui/icon-paths";

import { Icon } from "./Icon";

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
  { path: nxmMod, label: "nxmMod" },
  { path: nxmModOutline, label: "nxmModOutline" },
  { path: nxmCollection, label: "nxmCollection" },
  { path: nxmDiscord, label: "nxmDiscord" },
];

const imageSizes = ["size-4", "size-5", "size-6", "size-8", "size-12"] as const;

const colorIcons = [
  { name: "favorite", label: "Danger", className: "text-danger-strong" },
  { name: "star", label: "Warning", className: "text-warning-strong" },
  { name: "download", label: "Success", className: "text-success-strong" },
  { name: "search", label: "Info", className: "text-info-strong" },
] as const;

export const IconDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Icon
      </Typography>

      <Typography appearance="subdued">
        {`Icon component with predefined sizes and accessibility support. Draws `}

        <span className="font-semibold">Material Symbols</span>

        {` from the variable font by name, and takes an SVG path for the custom `}

        <span className="font-semibold">nxm*</span>

        {` icons of Nexus Mods-specific shapes the font doesn't have.`}
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

        <span className="font-semibold">filled</span>

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
            <Icon filled={fill} name="star" size="xl" />

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
            <Icon name="star" size={size} />

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
        {symbols.map(({ name, label }) => (
          <div className="flex flex-col items-center gap-2" key={label}>
            <Icon name={name} size="lg" title={label} />

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
        {symbols.map(({ name, label }) => (
          <Icon key={label} name={name} size="lg" />
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
        In an Image
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        An image's fallback icon and spinner are drawn at 20px, or three quarters of the image's
        height in a smaller one, so they fit it whatever its size.
      </Typography>

      <div className="flex flex-wrap items-end gap-6">
        {imageSizes.map((size) => (
          <div className="flex flex-col items-center gap-2" key={size}>
            <div className="flex items-end gap-2">
              <Image alt="" className={size} fallbackIcon="person" imageType="avatar" />

              <Image isLoading alt="" className={size} imageType="avatar" />
            </div>

            <Typography appearance="subdued" typographyType="body-xs">
              {size}
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
        {colorIcons.map(({ name, label, className }) => (
          <Icon className={className} key={label} name={name} size="xl" />
        ))}
      </div>
    </div>
  </div>
);
