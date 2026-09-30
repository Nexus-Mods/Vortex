import { Description as HeadlessDescription, type DescriptionProps } from "@headlessui/react";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export type IErrorMessageProps = Omit<DescriptionProps<"p">, "className"> & {
  className?: string;
};

/**
 * Why the control in its `Field` is invalid. Headless UI has no error part, so this is a
 * `Description` styled as one; pair it with `invalid` on the control.
 */
export const ErrorMessage = ({ className, ...props }: IErrorMessageProps) => (
  <HeadlessDescription className={joinClasses(["nxm-field-error-message", className])} {...props} />
);
