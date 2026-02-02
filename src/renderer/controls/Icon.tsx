// using fs directly because the svg may be bundled inside the asar so
// we need the electron-fs hook here
import * as fs from "fs/promises";
import * as path from "path";
import React, {
  type CSSProperties,
  type FC,
  type MouseEventHandler,
} from "react";

import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";

// Use window-scoped map so all code bundles (including extensions) share it.
// This prevents race conditions where one bundle starts loading an icon set
// and another bundle sees the DOM element but not the loaded symbols.
declare global {
  interface Window {
    __iconSetPromises?: Map<string, Promise<Set<string>>>;
  }
}

const getIconSetPromises = (): Map<string, Promise<Set<string>>> => {
  if (!window.__iconSetPromises) {
    window.__iconSetPromises = new Map();
  }
  return window.__iconSetPromises;
};

const debugMissingIcons = process.env.NODE_ENV === "development";
const debugReported = new Set<string>();

export interface IIconProps {
  id?: string;
  className?: string;
  style?: CSSProperties;
  set?: string;
  name: string;
  spin?: boolean;
  pulse?: boolean;
  stroke?: boolean;
  hollow?: boolean;
  border?: boolean;
  flip?: "horizontal" | "vertical";
  rotate?: number;
  svgStyle?: string;
  onContextMenu?: MouseEventHandler<SVGSVGElement>;
}

/**
 * Install a custom icon set from a given path (for extensions).
 */
export const installIconSet = (
  set: string,
  setPath: string,
): Promise<Set<string>> => {
  const promises = getIconSetPromises();

  if (promises.has(set)) {
    return promises.get(set);
  }

  // Create and store the promise BEFORE starting the async operation.
  // This prevents race conditions where another icon sees the DOM element
  // but the promise isn't in the map yet.
  const promise = (async () => {
    const container = document.createElement("div");
    container.id = "iconset-" + set;
    document.getElementById("icon-sets").appendChild(container);
    log("info", "read font", setPath);

    const data = await fs.readFile(setPath);
    container.innerHTML = data.toString();

    const symbols = new Set<string>();
    container.querySelectorAll("symbol").forEach((el) => symbols.add(el.id));
    return symbols;
  })();

  promises.set(set, promise);

  return promise;
};

const getOrLoadIconSet = (set: string): Promise<Set<string>> => {
  const promises = getIconSetPromises();

  if (promises.has(set)) {
    return promises.get(set);
  }

  // Check for DOM element loaded by legacy code (before promise map existed)
  const existing = document.getElementById("iconset-" + set);
  if (existing !== null) {
    const symbols = new Set<string>();
    existing.querySelectorAll("symbol").forEach((el) => symbols.add(el.id));
    const resolved = Promise.resolve(symbols);
    promises.set(set, resolved);
    return resolved;
  }

  const fontPath = path.resolve(getVortexPath("assets"), "fonts", set + ".svg");
  return installIconSet(set, fontPath);
};

const checkMissingIcon = (set: string, name: string): void => {
  if (!debugMissingIcons || debugReported.has(name)) return;
  void getOrLoadIconSet(set).then((symbols) => {
    if (symbols !== null && !symbols.has("icon-" + name)) {
      console.trace("icon missing", name);
      debugReported.add(name);
    }
  });
};

export const Icon: FC<IIconProps> = ({
  id,
  className,
  style,
  set = "icons",
  name,
  spin,
  pulse,
  stroke,
  hollow,
  border,
  flip,
  rotate,
  svgStyle,
  onContextMenu,
}) => {
  // Ensure icon set is loaded (idempotent due to promise caching)
  void getOrLoadIconSet(set);
  checkMissingIcon(set, name);

  const classes = [
    "icon",
    `icon-${name}`,
    (spin || name === "spinner") && "icon-spin",
    pulse && "icon-pulse",
    border && "icon-border",
    stroke && "icon-stroke",
    hollow && "icon-hollow",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={classes}
      id={id}
      preserveAspectRatio="xMidYMid meet"
      style={
        rotate
          ? {
              ...style,
              transform: `rotateZ(${rotate}deg)`,
              transformStyle: "preserve-3d",
            }
          : style
      }
      onContextMenu={onContextMenu}
    >
      {svgStyle ? <style type="text/css">{svgStyle}</style> : null}

      <use
        className="svg-use"
        transform={
          flip === "horizontal"
            ? "scale(-1, 1)"
            : flip === "vertical"
              ? "scale(1, -1)"
              : undefined
        }
        xlinkHref={`#icon-${name}`}
      />
    </svg>
  );
};

export default Icon;
