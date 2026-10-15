import { mdiCheck, mdiChevronDown, mdiChevronUp, mdiContentCopy } from "@mdi/js";
import React, { useEffect, useState } from "react";

import { Icon } from "@/ui/components/icon/Icon";

/** How long the copy button shows a tick after the message has been copied. */
const COPIED_MS = 2000;

interface IMessageBoxProps {
  /** The text to show in the box, which can be selected and copied. */
  message: string;
  /** Hides the box behind a toggle, which starts closed. */
  isCollapsible: boolean;
  /** Wraps long lines instead of scrolling sideways. */
  shouldWrap: boolean;
  /** The toggle's label while the box is open. */
  hideLabel: string;
  /** The toggle's label while the box is closed. */
  showLabel: string;
  /** The copy button's label. */
  copyLabel: string;
}

/**
 * A read-only, selectable box for details such as an error message or a path, with a button that
 * copies it, optionally behind a "show details" toggle that starts closed. It has no margin of
 * its own: its parent places it.
 */
export const MessageBox = ({
  copyLabel,
  hideLabel,
  isCollapsible,
  message,
  shouldWrap,
  showLabel,
}: IMessageBoxProps) => {
  const [isOpen, setIsOpen] = useState(!isCollapsible);
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if (!hasCopied) {
      return undefined;
    }

    const timer = setTimeout(() => setHasCopied(false), COPIED_MS);

    return () => clearTimeout(timer);
  }, [hasCopied]);

  const copy = () => {
    void window.api.clipboard.writeText(message).then(() => setHasCopied(true));
  };

  return (
    <div className="nxm-message-box">
      <div className="nxm-message-box-header">
        {isCollapsible && (
          <button
            aria-expanded={isOpen}
            className="nxm-message-box-toggle"
            data-testid="dialog-message-toggle"
            type="button"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? hideLabel : showLabel}

            <Icon path={isOpen ? mdiChevronUp : mdiChevronDown} size="sm" />
          </button>
        )}

        {isOpen && (
          <button
            className="nxm-button nxm-button-neutral nxm-button-moderate nxm-button-sm nxm-message-box-copy"
            data-testid="dialog-message-copy"
            type="button"
            onClick={copy}
          >
            <Icon
              className="nxm-button-icon"
              path={hasCopied ? mdiCheck : mdiContentCopy}
              size="none"
            />

            <span>{copyLabel}</span>
          </button>
        )}
      </div>

      {isOpen && (
        <textarea
          className="nxm-message-box-text"
          data-testid="dialog-message"
          readOnly
          value={message}
          wrap={shouldWrap ? "soft" : "off"}
        />
      )}
    </div>
  );
};
