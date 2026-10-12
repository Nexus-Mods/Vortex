import { mdiChevronDown, mdiChevronUp } from "@mdi/js";
import React, { useState } from "react";

import { TypographyLink } from "@/ui/components/typography/TypographyLink";

interface IMessageBoxProps {
  message: string;
  /** Hides the box behind a toggle, which starts closed. */
  isCollapsible: boolean;
  /** Wraps long lines instead of scrolling sideways. */
  shouldWrap: boolean;
  hideLabel: string;
  showLabel: string;
}

/**
 * A read-only, selectable box for details such as an error message or a path, optionally behind a
 * "show details" toggle that starts closed.
 */
export const MessageBox = ({
  hideLabel,
  isCollapsible,
  message,
  shouldWrap,
  showLabel,
}: IMessageBoxProps) => {
  const [isOpen, setIsOpen] = useState(!isCollapsible);

  return (
    <div className="mt-3 flex flex-col items-start gap-y-2">
      {isCollapsible && (
        <TypographyLink
          aria-expanded={isOpen}
          data-testid="dialog-message-toggle"
          rightIconPath={isOpen ? mdiChevronUp : mdiChevronDown}
          typographyType="body-sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? hideLabel : showLabel}
        </TypographyLink>
      )}

      {isOpen && (
        <textarea
          className="block field-sizing-content max-h-48 min-h-9 w-full resize-none overflow-auto rounded-lg border border-stroke-weak bg-transparent p-2 text-xs text-neutral-subdued select-text"
          data-testid="dialog-message"
          readOnly
          value={message}
          wrap={shouldWrap ? "soft" : "off"}
        />
      )}
    </div>
  );
};
