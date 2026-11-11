import React, { useRef } from "react";
import { useTranslation } from "react-i18next";

import { TextField } from "@/ui/components/form/text_field/TextField";
import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface ISearchProps {
  /** The text in the box. */
  value: string;
  /** Takes the text as it's typed, or emptied by Clear or Escape. */
  onChange: (value: string) => void;
  /** Searches for the text, on Enter; without it the box searches as it's typed. */
  onSubmit?: () => void;
  /** Shown in the empty box, and its label without `label`. */
  placeholder?: string;
  /** Names the box for screen readers; the placeholder without it. */
  label?: string;
  /** Classes for the form around the box. */
  className?: string;
  /** How many characters it takes, stopping there without a count. */
  maxLength?: number;
  /** Says why the text can't be searched for, in a tooltip under the box, while it's set. */
  errorMessage?: string;
  /** Called as focus leaves the box. */
  onBlur?: () => void;
}

/**
 * A search box with a search icon, and a clear button while it holds text, which puts focus back
 * in the box. Escape clears it too. An error shows in a tooltip under the box, so a toolbar it's
 * in doesn't move; screen readers get it from the box.
 */
export const Search = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  className,
  maxLength,
  errorMessage,
  onBlur,
}: ISearchProps) => {
  const { t } = useTranslation();
  const fieldRef = useRef<HTMLDivElement>(null);

  return (
    <form
      className={joinClasses(["flex items-center", className])}
      onSubmit={(evt) => {
        evt.preventDefault();
        onSubmit?.();
      }}
    >
      <Tooltip
        persistent
        content={errorMessage ?? ""}
        open={!!errorMessage}
        placement="bottom-start"
      >
        <div className="relative" ref={fieldRef}>
          <TextField
            hideCharacterCount
            hideErrors
            className="pr-9"
            data-testid="search-input"
            errorMessage={errorMessage}
            fieldClassName="w-full max-w-60"
            hideLabel={true}
            label={label ?? placeholder ?? ""}
            leftIcon="search"
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={(evt) => onChange(evt.target.value)}
            onBlur={onBlur}
            onKeyDown={(evt) => {
              if (evt.key !== "Escape" || !value) {
                return;
              }

              evt.preventDefault();
              evt.stopPropagation();
              onChange("");
            }}
          />

          {!!value && (
            <button
              aria-label={t("Clear search")}
              className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center justify-center rounded-xs text-neutral-subdued transition-colors hover:text-neutral-strong"
              data-testid="search-clear"
              type="button"
              onClick={() => {
                onChange("");
                fieldRef.current?.querySelector("input")?.focus();
              }}
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>
      </Tooltip>
    </form>
  );
};
