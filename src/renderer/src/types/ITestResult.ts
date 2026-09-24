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
  // whether the user may hide this result for good; defaults to true for anything below an error
  allowSuppress?: boolean;
  automaticFix?: () => PromiseLike<void>;
  onRecheck?: () => PromiseLike<void>;
}
