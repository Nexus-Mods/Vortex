import React, { type CSSProperties, type HTMLAttributes, type SVGAttributes } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { SymbolName } from "./symbols";

export type { SymbolName } from "./symbols";

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

// A symbol is one em square, so it takes its size from the font size. The same steps as
// `sizeMap`, in pixels, as the font's optical size follows from them.
const symbolFontSizeMap: { [key in IIconSize]: string | undefined } = {
  none: undefined,
  xs: "text-[12px]",
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[24px]",
  xl: "text-[32px]",
  "2xl": "text-[48px]",
};

interface IIconBaseProps {
  size?: IIconSize;
  title?: string;
}

/** An icon drawn from an SVG path in a 24x24 `viewBox`, for the custom `nxm*` icons the font lacks. */
export type IPathIconProps = IIconBaseProps &
  Omit<SVGAttributes<SVGSVGElement>, "size" | "path"> & {
    path: string;
    name?: never;
  };

/** An icon drawn from Material Symbols, the variable font, by the symbol's name from `symbols.ts`. */
export type ISymbolIconProps = IIconBaseProps &
  Omit<HTMLAttributes<HTMLSpanElement>, "children" | "title"> & {
    name: SymbolName;
    path?: never;
    /** The solid form of the symbol, where it has one: the font's fill axis. */
    fill?: boolean;
    /** The font's weight axis. It is 400 when not given, whatever the text around it is. */
    weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
    /** The font's grade axis: a finer weight, thinner below 0 and bolder above it. */
    grade?: -25 | 0 | 200;
    /**
     * The font's optical size axis, from 20 to 48: the larger, the finer the strokes. It follows
     * `size` when not given, and is for when an icon should be drawn for a size it isn't.
     */
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
    className={joinClasses(["shrink-0", sizeMap[size], className])}
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
  fill,
  weight,
  grade,
  opticalSize,
  style,
  ...props
}: Omit<ISymbolIconProps, "path">) => {
  const axes: string[] = [];

  if (fill !== undefined) axes.push(`"FILL" ${fill ? 1 : 0}`);
  if (grade !== undefined) axes.push(`"GRAD" ${grade}`);
  if (opticalSize !== undefined) axes.push(`"opsz" ${opticalSize}`);

  const axesStyle: CSSProperties = {
    ...(weight !== undefined && { fontWeight: weight }),
    ...(axes.length > 0 && { fontVariationSettings: axes.join(", ") }),
  };

  return (
    <span
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={joinClasses([
        "material-symbols-outlined shrink-0 overflow-hidden select-none",
        sizeMap[size],
        symbolFontSizeMap[size],
        className,
      ])}
      role={title ? "img" : undefined}
      data-symbol={name}
      style={{ ...axesStyle, ...style }}
      {...props}
    />
  );
};

/**
 * A Material Symbol as a component takes it: its name, or the name with the font axes it is drawn
 * with, as `{ name: "star", fill: true }`. What a prop called `symbol` is.
 */
export type ISymbolSource =
  | SymbolName
  | Pick<ISymbolIconProps, "name" | "fill" | "weight" | "grade" | "opticalSize">;

/** The props that draw a symbol from the source, for `<Icon {...symbolProps(symbol)} />`. */
export const symbolProps = (symbol: ISymbolSource) =>
  typeof symbol === "string" ? { name: symbol } : symbol;

const isSymbol = (props: IIconProps): props is ISymbolIconProps => props.name !== undefined;

/**
 * An icon, from either of the two things Vortex draws them from: `name` picks a Material
 * Symbol, drawn from the font, and `path` takes an SVG path, for what the font doesn't have.
 */
export const Icon = (props: IIconProps) =>
  isSymbol(props) ? <SymbolIcon {...props} /> : <PathIcon {...props} />;
