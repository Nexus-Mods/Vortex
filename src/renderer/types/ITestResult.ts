import type PromiseBB from "bluebird";

export type ProblemSeverity = "warning" | "error" | "fatal";

export interface ITestResult {
  description: {
    short: string;
    long?: string;
    replace?: { [key: string]: any };
    localize?: boolean;
    context?: any;
  };
  severity: ProblemSeverity;
  automaticFix?: () => PromiseBB<void>;
  onRecheck?: () => PromiseBB<void>;
}
