import { Textarea as HeadlessTextarea, type TextareaProps } from "@headlessui/react";
import React, { forwardRef } from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

export type ITextareaProps = Omit<TextareaProps, "className"> & {
  /** Classes for the text area, added to its base ones. */
  className?: string;
};

/**
 * A bare multi-line text input, drawn like `Input`. Inside a `Field` it's named by the field's
 * `Label`; on its own it needs an `aria-label`. For the usual label, hints and error in one, use
 * `TextAreaField`.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, ITextareaProps>(
  ({ className, ...props }, ref) => (
    <HeadlessTextarea
      className={joinClasses(["nxm-input nxm-textarea", className])}
      ref={ref}
      {...props}
    />
  ),
);
