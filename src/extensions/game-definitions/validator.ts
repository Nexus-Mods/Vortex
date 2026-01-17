import type { ValidationResult } from "./types";

/**
 * Validates a game definition object with basic checks.
 * The JSON schema is kept for IDE autocompletion but not used at runtime
 * to avoid Ajv version conflicts with the rest of the project.
 *
 * @param data - The parsed YAML data to validate
 * @returns A ValidationResult indicating whether the data is valid and any errors
 */
export function validateGameDef(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["root: must be an object"] };
  }

  const def = data as Record<string, unknown>;

  // Check required fields
  const requiredFields = ["id", "name", "logo", "executable", "modPath"];
  for (const field of requiredFields) {
    if (def[field] === undefined) {
      errors.push(`root: missing required field '${field}'`);
    }
  }

  // Validate id format
  if (typeof def.id === "string" && !/^[a-z0-9-]+$/.test(def.id)) {
    errors.push("id: must be lowercase alphanumeric with hyphens only");
  }

  // Validate executable type
  if (
    def.executable !== undefined &&
    typeof def.executable !== "string" &&
    !Array.isArray(def.executable)
  ) {
    errors.push("executable: must be a string or array of strings");
  }

  // Validate stores if present
  if (def.stores !== undefined) {
    if (typeof def.stores !== "object" || def.stores === null) {
      errors.push("stores: must be an object");
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
