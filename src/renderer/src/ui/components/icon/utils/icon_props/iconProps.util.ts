import { isValidElement } from "react";

import type { IIconProp, IIconProps, IIconSource } from "../../Icon";

/** Whether an `icon` prop is a source for `Icon` to draw, and not an element to show as it is. */
export const isIconSource = (icon: IIconProp): icon is IIconSource =>
  typeof icon === "string" ||
  (typeof icon === "object" &&
    icon !== null &&
    !isValidElement(icon) &&
    ("name" in icon || "path" in icon));

/** The props that draw a source, for `<Icon {...getIconProps(source)} />`. */
export const getIconProps = (source: IIconSource): IIconProps =>
  typeof source === "string" ? { name: source } : source;
