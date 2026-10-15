import React, {
  type ButtonHTMLAttributes,
  forwardRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type Ref,
  type RefAttributes,
} from "react";

import { type IIconProp, IconSlot } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

/** Colour family. Tints the icon only; `light` takes the strong step where `neutral` does not. */
export type IPillBrand =
  | "primary"
  | "info"
  | "neutral"
  | "light"
  | "success"
  | "danger"
  | "warning"
  | "premium";

/** The pill's treatment. `scrim` paints a scrim fill of its own; `none` opts out of both. */
export type IPillAppearance = "subdued" | "scrim" | "none";

type IBasePillProps = {
  appearance?: IPillAppearance;
  brand?: IPillBrand;
  children: string;
  icon?: IIconProp;
};

type IPillDefaultProps = HTMLAttributes<HTMLDivElement> & {
  as?: never;
} & IBasePillProps;

type IButtonPillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  as: "button";
  className?: string;
  disabled?: boolean;
} & IBasePillProps;

type IPillProps = IPillDefaultProps | IButtonPillProps;

type IPillElement = HTMLButtonElement | HTMLDivElement;
type IPill = ForwardRefExoticComponent<IPillProps & RefAttributes<IPillElement>>;

const getPillClasses = (
  { appearance = "subdued", brand = "neutral" }: Pick<IBasePillProps, "appearance" | "brand">,
  className?: string,
) => joinClasses(["nxm-pill", `nxm-pill-${brand}`, `nxm-pill-${appearance}`, className]);

const Content = ({ icon, label }: Pick<IPillProps, "icon"> & { label?: string }) => (
  <>
    <IconSlot className="nxm-pill-icon" icon={icon} />

    <span className="nxm-pill-label">{label}</span>
  </>
);

export const Pill: IPill = forwardRef<IPillElement, IPillProps>((allProps, ref) => {
  const { appearance, brand, children, className, icon, ...rest } = allProps;

  const content = <Content icon={icon} label={children} />;

  if (rest.as === "button") {
    const { as, disabled, ...props } = rest;

    return (
      <button
        className={getPillClasses({ appearance, brand }, className)}
        disabled={disabled}
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        {...props}
      >
        {content}
      </button>
    );
  }

  const { as, ...props } = rest as IPillDefaultProps;

  return (
    <div
      className={getPillClasses({ appearance, brand }, className)}
      ref={ref as Ref<HTMLDivElement>}
      {...props}
    >
      {content}
    </div>
  );
});

Pill.displayName = "Pill";
