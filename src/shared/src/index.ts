// oxlint-disable-next-line import/no-unassigned-import -- must run before any module below constructs a zod schema
import "./zodJitless";

export * from "./constants";
export * from "./Debouncer";
export * from "./errors";
export * from "./error-serialization";
export * from "./download-errors";
export * from "./types/logging";

export { VortexError } from "./errors/base";
export type {
  VortexErrorData,
  VortexErrorKind,
  VortexErrorKindMap,
  FileSystemErrorData,
  OsErrorData,
} from "./errors/base.ts";
export { parseError } from "./errors/parser";

export { isPromiseLike } from "./guard";
