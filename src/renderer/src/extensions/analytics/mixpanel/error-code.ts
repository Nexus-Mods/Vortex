import { VortexError } from "@vortex/shared/errors";

export function classifyErrorCode(err: unknown): string {
  if (err instanceof VortexError) {
    return err.data.kind;
  }

  if (err instanceof Error) {
    return err.name;
  }

  return "unknown";
}
