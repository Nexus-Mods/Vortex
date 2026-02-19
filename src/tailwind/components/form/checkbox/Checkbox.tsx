import React, { type InputHTMLAttributes, type PropsWithChildren } from "react";
import { joinClasses } from "../../../../renderer/ui/utils/joinClasses";
import { Icon } from "../../../../renderer/ui/components/icon/Icon";

export const Checkbox = ({
  checked,
  children,
  className,
  disabled,
  hasError,
  ...inputProps
}: PropsWithChildren<
  Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { hasError?: boolean }
>) => (
  <label
    className={joinClasses(["nxm-checkbox-field", className], {
      "nxm-checkbox-checked": checked,
      "nxm-checkbox-disabled": disabled,
      "nxm-checkbox-error": hasError,
    })}
  >
    <input
      checked={checked}
      className="nxm-checkbox-input"
      disabled={disabled}
      type="checkbox"
      {...inputProps}
    />

    <span className="nxm-checkbox">
      <Icon className="nxm-checkbox-icon" path="mdiCheck" size="sm" />
    </span>

    <span className="nxm-checkbox-label">{children}</span>
  </label>
);
