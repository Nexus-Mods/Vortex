import type { Assert, MutuallyAssignable, NexusGameId, RecordedGameUid } from "@vortex/shared";
import { VortexGameId } from "@vortex/shared";
import { z } from "zod";

/** A game an extension registers, as its manifest declares it. */
export interface ContributedGame {
  /**
   * The Nexus Mods game this game's mods are published on. Absent means none: listing the game
   * here is the declaration, so Vortex doesn't fall back to its legacy lookups for it.
   */
  nexusGameId?: NexusGameId;
  /** The listing name, for places that can't run the extension. Vortex shows the name passed to `registerGame`. */
  name?: string;
  /**
   * The game this registration supports, as its catalogue id, as written. Optional when the game is
   * the one `nexusGameId` belongs to; required when it isn't (Skyrim VR, whose mods are on Skyrim
   * Special Edition's) or when the game isn't on Nexus Mods at all.
   */
  gameUid?: RecordedGameUid;
}

/** A game an extension enhances without registering it. Exactly one target is set. */
export type GameEnhancement =
  | {
      /** One game exactly. */
      gameUid: RecordedGameUid;
      nexusGameId?: undefined;
    }
  | {
      /** Every game whose mods are published on this Nexus Mods game (coarse). */
      nexusGameId: NexusGameId;
      gameUid?: undefined;
    };

/** What an extension contributes to Vortex, declared in its info.json and readable without running it. */
export interface Contributes {
  /**
   * The games the extension registers, keyed by the id it registers them under. The static
   * counterpart of `registerGame`: registering an id that isn't listed here is an error.
   */
  games?: Record<VortexGameId, ContributedGame>;
  /** The games the extension is relevant to without registering them. Advisory. */
  gameEnhancements?: GameEnhancement[];
}

/** Reserved for the games Vortex manages without an extension. */
const TIER_ZERO_PREFIX = "tier-0-";

const vortexGameIdSchema = z
  .string()
  .min(1)
  .refine((id) => !id.startsWith(TIER_ZERO_PREFIX), {
    message: `the "${TIER_ZERO_PREFIX}" prefix is reserved for games Vortex manages without an extension`,
  })
  .transform((id) => VortexGameId(id));

// The brands are type-only, so these brand with a type-guard refine rather than `.transform`: zod
// types a transformed object key as optional, which would make the enhancement union below drift
// from its type.
const nexusGameIdSchema = z
  .number()
  .int()
  .positive()
  .refine((id): id is NexusGameId => true);

// A non-empty string, not a uuid check: catalogue ids are opaque. Lowercased so it compares with
// the uids the backend sends; `.toLowerCase()` keeps the output type, so the drift checks hold.
const gameUidSchema = z
  .string()
  .min(1)
  .toLowerCase()
  .refine((id): id is RecordedGameUid => true);

const contributedGameSchema = z.object({
  nexusGameId: nexusGameIdSchema.optional(),
  name: z.string().min(1).optional(),
  gameUid: gameUidSchema.optional(),
});

// typecheck fails when the schema and its type drift apart
type _ContributedGameMatches = Assert<
  MutuallyAssignable<z.infer<typeof contributedGameSchema>, ContributedGame>
>;

// a union rather than a refine, so the inferred type is the union above
const gameEnhancementSchema = z.union(
  [
    z.object({ gameUid: gameUidSchema, nexusGameId: z.undefined().optional() }),
    z.object({ nexusGameId: nexusGameIdSchema, gameUid: z.undefined().optional() }),
  ],
  { error: "a game enhancement sets exactly one of gameUid and nexusGameId" },
);

type _GameEnhancementMatches = Assert<
  MutuallyAssignable<z.infer<typeof gameEnhancementSchema>, GameEnhancement>
>;

export const ContributesSchema = z.object({
  games: z.record(vortexGameIdSchema, contributedGameSchema).optional(),
  gameEnhancements: z.array(gameEnhancementSchema).optional(),
});

type _ContributesMatches = Assert<
  MutuallyAssignable<z.infer<typeof ContributesSchema>, Contributes>
>;
