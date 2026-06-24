import { mdiAlertOctagonOutline, mdiAlertOutline, mdiInformationOutline } from "@mdi/js";

export type Severity = "suggestion" | "warning" | "error";

export const severityStyleMap: Record<
  Severity,
  { backgroundClassName: string; iconPath: string; textClassName: string }
> = {
  error: {
    backgroundClassName: "bg-danger-strong",
    iconPath: mdiAlertOctagonOutline,
    textClassName: "text-danger-strong",
  },
  suggestion: {
    backgroundClassName: "bg-info-moderate",
    iconPath: mdiInformationOutline,
    textClassName: "text-info-moderate",
  },
  warning: {
    backgroundClassName: "bg-warning-moderate",
    iconPath: mdiAlertOutline,
    textClassName: "text-warning-moderate",
  },
};
