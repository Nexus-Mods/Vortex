/**
 * Icon Component
 * Adapted from web team's "next" project for Vortex
 *
 * Renders Material Design Icons using SVG path data from @mdi/js
 * Compatible with both string path names (e.g., 'mdiAccount') and direct path data
 */

import * as React from 'react';
import * as mdi from '@mdi/js';

export interface IconProps {
  className?: string;
  /**
   * Either an MDI icon name (string like 'mdiAccount') or direct SVG path data
   * Icon names are automatically mapped to @mdi/js exports
   */
  path?: string;
  /**
   * Size of the icon. Use 'none' to control size via className only
   */
  size?: 'none' | number | string;
  /**
   * Icon title for accessibility (optional)
   */
  title?: string;
  /**
   * Additional SVG attributes
   */
  [key: string]: any;
}

/**
 * Icon component that renders Material Design Icons
 *
 * Usage:
 * - With icon name: <Icon path="mdiAccount" size="1" />
 * - With direct path: <Icon path={mdiAccount} size="1" />
 * - With className sizing: <Icon path="mdiAccount" size="none" className="tw:size-5" />
 */
export const Icon: React.ComponentType<IconProps> = ({
  path,
  size = 1,
  className = '',
  title,
  ...rest
}) => {
  // Resolve path - if it's a string like 'mdiAccount', look it up in @mdi/js
  let svgPath: string | undefined;

  if (typeof path === 'string') {
    // Check if it's an icon name (starts with 'mdi') or already an SVG path
    if (path.startsWith('mdi') && path.length > 3) {
      // It's an icon name like 'mdiAccount' - look it up
      svgPath = (mdi as any)[path];

      if (!svgPath) {
        console.warn(`Icon: Unknown MDI icon name "${path}". Check @mdi/js exports.`);
        return null;
      }
    } else if (path.startsWith('M') || path.startsWith('m')) {
      // It's already an SVG path data string
      svgPath = path;
    } else {
      console.warn(`Icon: Invalid path "${path}". Expected MDI icon name or SVG path data.`);
      return null;
    }
  }

  if (!svgPath) {
    return null;
  }

  // Calculate size attributes
  const sizeValue = size === 'none' ? undefined : (typeof size === 'number' ? `${size * 24}px` : size);

  return (
    <svg
      viewBox="0 0 24 24"
      width={sizeValue}
      height={sizeValue}
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={svgPath} fill="currentColor" />
    </svg>
  );
};
