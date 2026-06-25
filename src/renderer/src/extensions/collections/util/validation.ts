export interface IValidationResult {
  valid: "success" | "warning" | "error";
  reason?: string;
}
