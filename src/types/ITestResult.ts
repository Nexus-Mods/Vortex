import Promise from 'bluebird';

export type ProblemSeverity = 'warning' | 'error';

export interface ITestResult {
  description: {
    short: string;
    long?: string;
    replace?: { [key: string]: any },
    localize?: boolean;
  };
  severity: ProblemSeverity;
  automaticFix?: () => Promise<void>;
  onRecheck?: () => Promise<void>;
}
