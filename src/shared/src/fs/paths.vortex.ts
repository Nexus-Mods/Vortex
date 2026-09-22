import type { VortexPaths } from "../types/ipc";
import type { PathProvider } from "./paths";

/**
 * Bases supported by the Vortex path provider: the identifiers of well-known
 * Vortex application locations.
 * * @public */
export type VortexPathBase = keyof VortexPaths;

/**
 * Factory for well-known Vortex application locations
 *
 * @public */
export interface IVortexPathProvider extends PathProvider<VortexPathBase> {}
