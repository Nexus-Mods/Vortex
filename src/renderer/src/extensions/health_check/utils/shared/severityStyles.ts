import type { IIconSource } from "@/ui/components/icon/Icon";

export type Severity = "suggestion" | "warning" | "error";

export const severityStyleMap: Record<
  Severity,
  { backgroundClassName: string; icon: IIconSource; textClassName: string }
> = {
  error: {
    backgroundClassName: "bg-danger-moderate",
    icon: "report",
    textClassName: "text-danger-strong",
  },
  suggestion: {
    backgroundClassName: "bg-info-moderate",
    icon: "info",
    textClassName: "text-info-strong",
  },
  warning: {
    backgroundClassName: "bg-warning-moderate",
    icon: "warning",
    textClassName: "text-warning-strong",
  },
};
