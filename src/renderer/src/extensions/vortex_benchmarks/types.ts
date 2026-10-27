export interface IBenchmarkOption {
  id: string;
  label: string;
  type: "text" | "number" | "directory";
  default: string | number;
}

export interface IBenchmarkContext {
  /** Option values by option id, as entered on the page. */
  options: Record<string, string | number>;
  /** Aborted when the user cancels the run. */
  signal: AbortSignal;
  /** Reports one JSON-serializable measurement, shown on the page as a JSON line. */
  report: (record: Record<string, unknown>) => void;
}

/** A benchmark the page can run. Add one to `benchmarks/index.ts` to make it show up. */
export interface IBenchmark {
  id: string;
  name: string;
  description: string;
  options: IBenchmarkOption[];
  run: (ctx: IBenchmarkContext) => Promise<void>;
}
