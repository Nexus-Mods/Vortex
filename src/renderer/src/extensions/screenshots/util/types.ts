import type { IState } from "@/types/api";

import type { IGameMediaPersistentState } from "../reducers/persistent";
import type { IGameMediaSessionState } from "../reducers/session";

/**
 * XOr type - ensures only one of two types can be used
 */
export type XOr<T, U> = T | U extends object
  ? (T & Partial<Record<keyof U, never>>) | (U & Partial<Record<keyof T, never>>)
  : T | U;

/**
 * Responsive screen sizes for Tailwind
 */
export type ResponsiveScreenSizes = "default" | "sm" | "md" | "lg" | "xl" | "2xl";

export type IStateWithGameMedia = IState & {
  persistent: { game_media: IGameMediaPersistentState };
} & { session: { game_media: IGameMediaSessionState } };
