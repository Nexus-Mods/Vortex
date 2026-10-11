import { mdiClose, mdiMagnify } from "@mdi/js";
import React, { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/ui/components/form/input/Input";
import { Icon } from "@/ui/components/icon/Icon";
import { ToolbarButton } from "@/ui/components/toolbar/ToolbarButton";

interface IToolbarSearchProps {
  /** Names the button and the input. */
  label: string;
  /** The text searched for. */
  value: string;
  /** Takes the text as it's typed, and "" once it's cleared. */
  onChange: (value: string) => void;
}

/**
 * A toolbar's search: a button that shows an input to its left, focused, over whatever's
 * beside it, so the toolbar keeps its layout. Open, the button closes it, clearing the text;
 * Escape clears the text, then closes it; so does leaving it empty. Open while it holds text.
 */
export const ToolbarSearch = ({ label, value, onChange }: IToolbarSearchProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(value !== "");
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // where focus goes once it opens or closes, when the user did it, rather than a render
  const focusNext = useRef<"input" | "button">(undefined);

  const isOpen = open || value !== "";

  useLayoutEffect(() => {
    if (focusNext.current === undefined) {
      return;
    }

    (focusNext.current === "input" ? inputRef : buttonRef).current?.focus();
    focusNext.current = undefined;
  }, [isOpen]);

  const toggle = (next: boolean, focus?: "input" | "button") => {
    focusNext.current = focus;
    setOpen(next);
  };

  const close = (focus?: "button") => {
    onChange("");
    toggle(false, focus);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") {
      return;
    }

    // Its own, not the page's or a panel's around it.
    event.preventDefault();
    event.stopPropagation();

    if (value !== "") {
      onChange("");
    } else {
      close("button");
    }
  };

  return (
    <div className="nxm-toolbar-search">
      {isOpen && (
        <div className="nxm-toolbar-search-field">
          <Icon className="nxm-input-icon" path={mdiMagnify} size="sm" />

          <Input
            aria-label={label}
            placeholder={label}
            ref={inputRef}
            value={value}
            onBlur={() => value === "" && toggle(false)}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      )}

      <ToolbarButton
        appearance="weak"
        aria-expanded={isOpen}
        brand="neutral"
        label={isOpen ? t("Close search") : label}
        leftIconPath={isOpen ? mdiClose : mdiMagnify}
        ref={buttonRef}
        // Ahead of the input's blur, which would close it before this could.
        onMouseDown={(event) => isOpen && event.preventDefault()}
        onClick={() => (isOpen ? close("button") : toggle(true, "input"))}
      />
    </div>
  );
};
