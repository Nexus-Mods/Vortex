import Ajv, { type ErrorObject } from "ajv";

import type { ValidationResult } from "./types";

// Load schema using require since resolveJsonModule is not enabled
// eslint-disable-next-line @typescript-eslint/no-require-imports
const schema = require("./game-definition.schema.json");

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

/**
 * Validates a game definition object against the JSON schema.
 *
 * @param data - The parsed YAML data to validate
 * @returns A ValidationResult indicating whether the data is valid and any errors
 */
export function validateGameDef(data: unknown): ValidationResult {
  const valid = validate(data);

  if (!valid) {
    const errors = validate.errors?.map((e: ErrorObject) => {
      // instancePath is the standard in Ajv 8.x, dataPath was used in older versions
      const path = (e as any).instancePath ?? (e as any).dataPath ?? "root";
      return `${path}: ${e.message}`;
    });
    return { valid: false, errors };
  }

  return { valid: true };
}
