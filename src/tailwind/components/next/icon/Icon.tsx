/**
 * Icon Component
 * Adapted from web team's "next" project for Vortex
 *
 * Renders icons using SVG path data from multiple sources:
 * - Material Design Icons (@mdi/js) - e.g., 'mdiAccount'
 * - Nexus Mods custom icons - e.g., 'nxmVortex', 'nxmCollection'
 * - Direct SVG path data
 *
 * Size System:
 * - xs: 0.75rem (12px) - Extra small icons
 * - sm: 1rem (16px) - Small icons
 * - md: 1.25rem (20px) - Medium icons (DEFAULT)
 * - lg: 1.5rem (24px) - Large icons
 * - xl: 2rem (32px) - Extra large icons
 * - 2xl: 3rem (48px) - 2X extra large icons
 * - none: Size controlled via className
 */

import * as React from "react";
import * as mdi from "@mdi/js";
import * as nxm from "../../../lib/icon-paths";
import { joinClasses } from "../utils";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "none";

const sizeMap: { [key in IconSize]: string | undefined } = {
  none: undefined,
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
  "2xl": "size-12",
};

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "size" | "path"> & {
  /**
   * Icon path or name (REQUIRED):
   * - MDI icon name: 'mdiAccount', 'mdiDownload', etc.
   * - Nexus icon name: 'nxmVortex', 'nxmCollection', etc.
   * - Direct SVG path data string
   * Icon names are automatically resolved from @mdi/js or Nexus icon paths
   */
  path: string;
  /**
   * Named size from design system (default: 'md')
   * Cannot be used with sizeOverride
   */
  size?: IconSize;
  /**
   * Icon title for accessibility (optional)
   */
  title?: string;
};

/**
 * Icon component that renders icons from multiple sources
 *
 * Usage:
 * - With MDI icon name: <Icon path="mdiAccount" size="md" />
 * - With Nexus icon name: <Icon path="nxmVortex" size="lg" />
 * - With direct path: <Icon path={mdiAccount} size="sm" />
 * - With className sizing: <Icon path="mdiAccount" size="none" className="size-5" />
 */
export const Icon = ({
  path,
  size = "md",
  className,
  title,
  ...rest
}: IconProps) => {
  // Resolve path - if it's a string like 'mdiAccount' or 'nxmVortex', look it up
  let svgPath: string | undefined;

  if (typeof path === "string") {
    // Check if it's an icon name or already an SVG path
    if (path.startsWith("mdi") && path.length > 3) {
      // It's a Material Design Icon name like 'mdiAccount' - look it up in @mdi/js
      svgPath = (mdi as any)[path];

      if (!svgPath) {
        console.warn(
          `Icon: Unknown MDI icon name "${path}". Check @mdi/js exports.`,
        );
        return null;
      }
    } else if (path.startsWith("nxm") && path.length > 3) {
      // It's a Nexus Mods icon name like 'nxmVortex' - look it up in our icon paths
      svgPath = (nxm as any)[path];

      if (!svgPath) {
        console.warn(
          `Icon: Unknown Nexus icon name "${path}". Check available nxm* icons.`,
        );
        return null;
      }
    } else if (path.startsWith("M") || path.startsWith("m")) {
      // It's already an SVG path data string
      svgPath = path;
    } else {
      console.warn(
        `Icon: Invalid path "${path}". Expected MDI icon name (mdi*), Nexus icon name (nxm*), or SVG path data.`,
      );
      return null;
    }
  } else {
    console.warn(`Icon: path prop must be a string. Received: ${typeof path}`);
    return null;
  }

  if (!svgPath) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={joinClasses([sizeMap[size], className])}
      role={title ? "img" : "presentation"}
      aria-label={title}
      {...rest}
    >
      {title && <title>{title}</title>}

      <path d={svgPath} fill="currentColor" />
    </svg>
  );
};
