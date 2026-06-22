import React, {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
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
  ref?: Ref<HTMLDivElement>;
} & IBasePillProps;

type IButtonPillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  as: "button";
  className?: string;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
} & IBasePillProps;

type IPillProps = IPillDefaultProps | IButtonPillProps;

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

export const Pill = (allProps: IPillProps) => {
  const { children, className, icon, iconPath, pillType, ref, ...rest } = allProps;

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
};
