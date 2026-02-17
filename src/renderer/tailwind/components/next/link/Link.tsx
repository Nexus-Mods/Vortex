/**
 * Link Component
 * Simple wrapper around anchor tags for Electron/Vortex
 *
 * This replaces the web team's Next.js Link component with a basic
 * anchor tag suitable for Electron applications.
 */

import * as React from "react";
import type { AnchorHTMLAttributes } from "react";
import { forwardRef } from "react";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  isExternal?: boolean;
  "aria-disabled"?: boolean;
  children?: React.ReactNode;
}

/**
 * Simple Link component for Electron
 * Renders a standard anchor tag with optional external link handling
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ children, href, isExternal, ...props }, ref) => {
    return (
      <a
        ref={ref}
        href={href}
        {...(isExternal ? { rel: "noreferrer", target: "_blank" } : {})}
        {...props}
      >
        {children}
      </a>
    );
  },
);

Link.displayName = "Link";
