import type { components } from "./generated/nexus-api-v3";

type ProblemDetails = components["schemas"]["ProblemDetails"];
type ValidationProblemItem = components["schemas"]["ValidationProblemItem"];

export class V3ApiError extends Error {
  public readonly status: number;
  public readonly problemType: string;
  public readonly detail: string;
  public readonly instance: string;
  public readonly validationErrors?: ValidationProblemItem[];

  constructor(
    problem: Partial<ProblemDetails> & { errors?: ValidationProblemItem[] },
  ) {
    super(problem.title || "Request failed");
    this.name = "V3ApiError";
    this.status = problem.status ?? 0;
    this.problemType = problem.type || "about:blank";
    this.detail = problem.detail || "";
    this.instance = problem.instance || "";
    this.validationErrors = problem.errors;
  }
}
