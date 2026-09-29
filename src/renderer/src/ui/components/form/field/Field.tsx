import { Field as HeadlessField, type FieldProps } from "@headlessui/react";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export type IFieldProps = Omit<FieldProps<"div">, "className"> & {
  className?: string;
};

/**
 * Groups a control with its `Label`, `Description`s and `ErrorMessage`. Headless UI links them
 * itself — the label names the control, every description is added to its `aria-describedby` —
 * so there are no ids to wire. `disabled` cascades to everything inside.
 */
export const Field = ({ className, ...props }: IFieldProps) => (
  <HeadlessField className={joinClasses(["nxm-field", className])} {...props} />
);
