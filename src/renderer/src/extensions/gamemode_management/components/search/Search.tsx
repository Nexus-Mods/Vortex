import { mdiClose, mdiMagnify } from "@mdi/js";
import React, { useRef } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/ui/components/form/input/Input";
import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface ISearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const Search = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  className,
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
      <div className="relative" ref={fieldRef}>
        <Icon
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-subdued"
          path={mdiMagnify}
          size="sm"
        />

        <Input
          className="px-9"
          fieldClassName="w-full max-w-60"
          hideLabel={true}
          label={label ?? placeholder ?? ""}
          placeholder={placeholder}
          value={value}
          onChange={(evt) => onChange(evt.target.value)}
        />

        {!!value && (
          <button
            aria-label={t("Clear search")}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-xs text-neutral-subdued transition-colors hover:text-neutral-strong"
            type="button"
            onClick={() => {
              onChange("");
              fieldRef.current?.querySelector("input")?.focus();
            }}
          >
            <Icon path={mdiClose} size="sm" />
          </button>
        )}
      </div>
    </form>
  );
};
