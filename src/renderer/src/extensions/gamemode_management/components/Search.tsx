import { mdiMagnify } from "@mdi/js";
import React from "react";

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
}: ISearchProps) => (
  <form
    className={joinClasses(["flex items-center", className])}
    onSubmit={(evt) => {
      evt.preventDefault();
      onSubmit?.();
    }}
  >
    <div className="relative">
      <Icon
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-subdued"
        path={mdiMagnify}
        size="sm"
      />

      <Input
        className="pl-9"
        fieldClassName="max-w-60"
        hideLabel={true}
        label={label ?? placeholder ?? ""}
        placeholder={placeholder}
        size="sm"
        value={value}
        onChange={(evt) => onChange(evt.target.value)}
      />
    </div>
  </form>
);
