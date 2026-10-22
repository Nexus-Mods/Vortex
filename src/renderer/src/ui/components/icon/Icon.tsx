import type { MaterialSymbol } from "material-symbols";
import React, {
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type SVGAttributes,
} from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { getIconProps, isIconSource } from "./utils/icon_props/iconProps.util";

/** A Material Symbol's name. A name the font doesn't have fails the typecheck. */
export type SymbolName = MaterialSymbol;

export type IIconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "none";

const sizeMap: { [key in IIconSize]: string | undefined } = {
  none: undefined,
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
  "2xl": "size-12",
};

// A symbol is one em square, so it takes its size from the font size: the same steps as `sizeMap`,
// in rem, so it scales with the rest of the app. The font's optical size follows from it.
const symbolFontSizeMap: { [key in IIconSize]: string | undefined } = {
  none: undefined,
  xs: "text-[0.75rem]",
  sm: "text-[1rem]",
  md: "text-[1.25rem]",
  lg: "text-[1.5rem]",
  xl: "text-[2rem]",
  "2xl": "text-[3rem]",
};

interface IIconBaseProps {
  /** Its size, from `xs` (12px) to `2xl` (48px); `none` leaves it to `className`. Default `md`. */
  size?: IIconSize;
  /** Names it for screen readers, not a hover tooltip (use `Tooltip`); without one it's decorative. */
  title?: string;
}

/** An icon drawn from an SVG path in a 24x24 `viewBox`, for the `nxm*` icons the font lacks. */
export type IPathIconProps = IIconBaseProps &
  Omit<SVGAttributes<SVGSVGElement>, "size" | "path"> & {
    /** The SVG path to draw. */
    path: string;
    /** Not taken with `path`; a symbol takes `name` instead. */
    name?: never;
  };

/** An icon drawn from Material Symbols, the variable font, by the symbol's name. */
export type ISymbolIconProps = IIconBaseProps &
  Omit<HTMLAttributes<HTMLSpanElement>, "children" | "title"> & {
    /** The symbol's name. */
    name: SymbolName;
    /** Not taken with `name`; an SVG takes `path` instead. */
    path?: never;
    /** The solid form of the symbol, where it has one: the font's fill axis. */
    filled?: boolean;
    /** The font's weight axis; 400 when not given, whatever the text around it is. */
    weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
    /** The font's grade axis: a finer weight, thinner below 0 and bolder above it. */
    grade?: -25 | 0 | 200;
    /** The font's optical size axis, 20 to 48; follows `size` unless drawn for another size. */
    opticalSize?: number;
  };

export type IIconProps = IPathIconProps | ISymbolIconProps;

const PathIcon = ({
  path,
  size = "md",
  className,
  title,
  ...props
}: Omit<IPathIconProps, "name">) => (
  <svg
    className={joinClasses(["nxm-icon", sizeMap[size], className])}
    role={title ? "img" : "presentation"}
    viewBox="0 0 24 24"
    {...props}
  >
    {!!title && <title>{title}</title>}

    <path d={path} fill="currentColor" />
  </svg>
);

const SymbolIcon = ({
  name,
  size = "md",
  className,
  title,
  filled,
  weight,
  grade,
  opticalSize,
  style,
  ...props
}: Omit<ISymbolIconProps, "path">) => {
  const axes: string[] = [];

  if (filled !== undefined) {
    axes.push(`"FILL" ${filled ? 1 : 0}`);
  }

  if (grade !== undefined) {
    axes.push(`"GRAD" ${grade}`);
  }

  if (opticalSize !== undefined) {
    axes.push(`"opsz" ${opticalSize}`);
  }

  const isLabelled = !!title || !!props["aria-label"];

  const axesStyle: CSSProperties = {
    ...(weight !== undefined && { fontWeight: weight }),
    ...(axes.length > 0 && { fontVariationSettings: axes.join(", ") }),
  };

  return (
    <span
      aria-hidden={isLabelled ? undefined : true}
      aria-label={title}
      className={joinClasses([
        "nxm-icon nxm-icon-symbol",
        sizeMap[size],
        symbolFontSizeMap[size],
        className,
      ])}
      data-symbol={name}
      role={isLabelled ? "img" : undefined}
      style={{ ...axesStyle, ...style }}
      {...props}
    />
  );
};

const isSymbol = (props: IIconProps): props is ISymbolIconProps => props.name !== undefined;

/**
 * An icon, from either of the two things Vortex draws them from: `name` picks a Material
 * Symbol, drawn from the font, and `path` takes an SVG path, for what the font doesn't have.
 */
export const Icon = (props: IIconProps) =>
  isSymbol(props) ? <SymbolIcon {...props} /> : <PathIcon {...props} />;

/**
 * An icon as a component's `icon` prop takes it for `Icon` to draw: a Material Symbol by its
 * name, or by `{ name, filled, … }` with the font axes it is drawn with, or an SVG path as
 * `{ path }`.
 */
export type IIconSource =
  | SymbolName
  | Pick<ISymbolIconProps, "name" | "filled" | "weight" | "grade" | "opticalSize">
  | { path: string };

/** What a component's `icon` prop takes: a source for `Icon` to draw, or an element as is. */
export type IIconProp = ReactElement | IIconSource;

interface IIconSlotProps {
  /** The class the component gives its icons, on the icon or on the box around an element. */
  className: string;
  /** The component's `icon` prop, as given. */
  icon?: IIconProp;
  /** The size a source is drawn at. Default `none`, for the class to size it. */
  size?: IIconSize;
}

/**
 * The icon a component shows for its `icon` prop: a source drawn by `Icon`, with the class and
 * size the component gives its icons, or an element in a box with that class. Nothing for no icon.
 */
export const IconSlot = ({ className, icon, size = "none" }: IIconSlotProps) => {
  if (!icon) {
    return null;
  }

  if (isIconSource(icon)) {
    return <Icon {...getIconProps(icon)} className={className} size={size} />;
  }

  return <span className={joinClasses(["nxm-icon", className])}>{icon}</span>;
};
