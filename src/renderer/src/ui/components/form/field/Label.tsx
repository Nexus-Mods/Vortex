import { Label as HeadlessLabel, type LabelProps } from "@headlessui/react";
import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { joinClasses } from "@/ui/utils/joinClasses";

export type ILabelProps = Omit<LabelProps<"label">, "children" | "className"> & {
  children: ReactNode;
  className?: string;
  /** Adds "(Required)" after the text. Doesn't make the control required; set that on it. */
  required?: boolean;
};

/**
 * Names the control in its `Field`. Hide it with `className="sr-only"`, never by leaving it out.
 * Give the control an `id` of its own and it has to be passed here as `htmlFor` too, or clicking
 * the label stops focusing it.
 */
export const Label = ({ children, className, required = false, ...props }: ILabelProps) => {
  const { t } = useTranslation();

  return (
    <HeadlessLabel className={joinClasses(["nxm-field-label", className])} {...props}>
      {children}

      {required && <span className="nxm-field-label-required">{` ${t("(Required)")}`}</span>}
    </HeadlessLabel>
  );
};
