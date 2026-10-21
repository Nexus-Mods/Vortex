import React, { useEffect, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

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
  /** Names the copy button, which shows only an icon, for screen readers and as its tooltip. */
  copyLabel: string;
  /** Called once the message has been copied, such as to say so in a toast. */
  onCopied?: () => void;
}

/**
 * A read-only, selectable box for details such as an error message or a path, with an icon button
 * in its top right corner that copies it, optionally behind a "show details" toggle that starts
 * closed. It has no margin of
 * its own: its parent places it.
 */
export const MessageBox = ({
  copyLabel,
  hideLabel,
  isCollapsible,
  message,
  onCopied,
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
    void window.api.clipboard.writeText(message).then(() => {
      setHasCopied(true);
      onCopied?.();
    });
  };

  return (
    <div className="nxm-message-box">
      {isCollapsible && (
        <button
          aria-expanded={isOpen}
          className="nxm-message-box-toggle"
          data-testid="dialog-message-toggle"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? hideLabel : showLabel}

          <Icon name={isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"} size="sm" />
        </button>
      )}

      {isOpen && (
        <div className="nxm-message-box-body">
          <textarea
            className="nxm-message-box-text"
            data-testid="dialog-message"
            readOnly
            value={message}
            wrap={shouldWrap ? "soft" : "off"}
          />

          <Tooltip content={copyLabel} placement="left">
            <Button
              appearance="weak"
              aria-label={copyLabel}
              brand="neutral"
              className="nxm-message-box-copy"
              data-testid="dialog-message-copy"
              leftIcon={hasCopied ? "check" : "content_copy"}
              size="sm"
              onClick={copy}
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
};
