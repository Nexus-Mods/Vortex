import { Input as HeadlessInput, type InputProps } from "@headlessui/react";
import React, { forwardRef } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export type IInputProps = Omit<InputProps<"input">, "className" | "type"> & {
  className?: string;
  type?: "text" | "email" | "password" | "url" | "number" | "time" | "date";
};

/**
 * A bare text input. Inside a `Field` it's named by the field's `Label`; on its own it needs an
 * `aria-label`. For the usual label, hints and error in one, use `TextField`.
 */
export const Input = forwardRef<HTMLInputElement, IInputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <HeadlessInput
      className={joinClasses(["nxm-input", className])}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);
