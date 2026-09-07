import React, { type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";

import { showUsageInstruction } from "@/actions";
import type { IState } from "@/types/IState";
import { Alert } from "@/ui/components/alert/Alert";

export interface IUsageAlertProps {
  infoId: string;
  className?: string;
  children: ReactNode;
}

/**
 * A hint about how to use the thing it sits beside, as an `Alert` the user can dismiss
 * for good — the decision is kept in `settings.interface.usage`, so it survives a
 * restart and applies wherever the same `infoId` is used.
 *
 * The design-system counterpart to `Usage`, which draws its own bar. It offers no
 * "show usage instructions" state to return from: this hint is a nudge for someone who
 * hasn't found the feature yet, and once they say they've read it, it's gone.
 */
export const UsageAlert = ({ children, className, infoId }: IUsageAlertProps) => {
  const dispatch = useDispatch();
  const show = useSelector((state: IState) => state.settings?.interface?.usage?.[infoId] !== false);

  if (!show) {
    return null;
  }

  return (
    <Alert
      className={className}
      severity="info"
      onDismiss={() => dispatch(showUsageInstruction(infoId, false))}
    >
      {children}
    </Alert>
  );
};
