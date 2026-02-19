import Promise from "bluebird";

export type ProblemSeverity = "warning" | "error";

export interface ITestResult {
  description: {
    short: string;
    long?: string;
  };
  severity: ProblemSeverity;
  automaticFix?: () => Promise<void>;
}
