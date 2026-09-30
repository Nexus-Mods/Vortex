import { Description as HeadlessDescription, type DescriptionProps } from "@headlessui/react";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export type IDescriptionProps = Omit<DescriptionProps<"p">, "className"> & {
  className?: string;
};

/** Hint text for the control in its `Field`, read out after the label. */
export const Description = ({ className, ...props }: IDescriptionProps) => (
  <HeadlessDescription className={joinClasses(["nxm-field-description", className])} {...props} />
);
