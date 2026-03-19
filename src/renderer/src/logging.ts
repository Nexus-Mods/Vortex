import type { Level } from "@vortex/shared";

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { message: value.message, name: value.name, stack: value.stack };
  }

  return value;
}

export function log(level: Level, message: string, metadata?: unknown) {
  const meta =
    metadata === undefined ? undefined : JSON.stringify(metadata, replacer);
  window.api.log(level, message, meta);
}
