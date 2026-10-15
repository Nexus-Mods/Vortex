import type { ISymbolSource } from "@/ui/components/icon/Icon";

export type Severity = "suggestion" | "warning" | "error";

export const severityStyleMap: Record<
  Severity,
  { backgroundClassName: string; symbol: ISymbolSource; textClassName: string }
> = {
  error: {
    backgroundClassName: "bg-danger-moderate",
    symbol: "report",
    textClassName: "text-danger-strong",
  },
  suggestion: {
    backgroundClassName: "bg-info-moderate",
    symbol: "info",
    textClassName: "text-info-strong",
  },
  warning: {
    backgroundClassName: "bg-warning-moderate",
    symbol: "warning",
    textClassName: "text-warning-strong",
  },
};
