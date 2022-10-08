import Bluebird from 'bluebird';

export type ProblemSeverity = 'warning' | 'error' | 'fatal';

export interface ITestResult {
  description: {
    short: string;
    long?: string;
    replace?: { [key: string]: any },
    localize?: boolean;
    context?: any;
  };
  severity: ProblemSeverity;
  automaticFix?: () => Bluebird<void>;
  onRecheck?: () => Bluebird<void>;
}
