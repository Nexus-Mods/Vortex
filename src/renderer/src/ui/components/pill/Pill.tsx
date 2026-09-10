import React, {
  type ButtonHTMLAttributes,
  forwardRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefAttributes,
} from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";
import type { XOr } from "@/ui/utils/types";

type IBasePillProps = {
  children: string;
  pillType?: "default" | "none" | "success";
} & XOr<{ iconPath?: string }, { icon?: ReactNode }>;

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

const getPillClasses = ({ pillType = "default" }: Pick<IBasePillProps, "pillType">) =>
  joinClasses("nxm-pill", {
    [`nxm-pill-${pillType}`]: pillType !== "none",
  });

const Content = ({
  icon,
  iconPath,
  label,
}: Pick<IPillProps, "icon" | "iconPath"> & { label?: string }) => (
  <>
    {!!icon && <span className="nxm-pill-icon flex items-center justify-center">{icon}</span>}

    {!!iconPath && <Icon className="nxm-pill-icon" path={iconPath} size="none" />}

    <span className="nxm-pill-label">{label}</span>
  </>
);

export const Pill: IPill = forwardRef<IPillElement, IPillProps>((allProps, ref) => {
  const { children, className, icon, iconPath, pillType, ...rest } = allProps;

  const content = <Content icon={icon} iconPath={iconPath} label={children} />;

  if (rest.as === "button") {
    const { as, disabled, ...props } = rest;

    return (
      <button
        className={joinClasses([getPillClasses({ pillType }), className])}
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
      className={joinClasses([getPillClasses({ pillType }), className])}
      ref={ref as Ref<HTMLDivElement>}
      {...props}
    >
      {content}
    </div>
  );
});

Pill.displayName = "Pill";
