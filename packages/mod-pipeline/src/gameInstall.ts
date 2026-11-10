import {
  GogBuildId,
  GogProductId,
  SteamAppId,
  SteamBuildId,
  SteamDepotId,
  SteamManifestId,
} from "./ids";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** The stores a game is installed from. */
export const GameStore = {
  Steam: "steam",
  Gog: "gog",
  Epic: "epic",
  Xbox: "xbox",
} as const;
export type GameStore = (typeof GameStore)[keyof typeof GameStore];

/** A game install, identified by its store's own ids. */
export type GameInstall =
  | {
      store: typeof GameStore.Steam;
      appId: SteamAppId;
      buildId: SteamBuildId;
      depots: { depotId: SteamDepotId; manifestId: SteamManifestId }[];
    }
  | { store: typeof GameStore.Gog; productId: GogProductId; buildId: GogBuildId }
  | { store: typeof GameStore.Epic }
  | { store: typeof GameStore.Xbox };

const gameInstallSchema = z.discriminatedUnion("store", [
  z.object({
    store: z.literal(GameStore.Steam),
    appId: z.number().int().transform(SteamAppId),
    buildId: z.number().int().transform(SteamBuildId),
    depots: z.array(
      z.object({
        depotId: z.number().int().transform(SteamDepotId),
        manifestId: z.string().transform(SteamManifestId),
      }),
    ),
  }),
  z.object({
    store: z.literal(GameStore.Gog),
    productId: z.string().transform(GogProductId),
    buildId: z.string().transform(GogBuildId),
  }),
  z.object({ store: z.literal(GameStore.Epic) }),
  z.object({ store: z.literal(GameStore.Xbox) }),
]);

// typecheck fails when the schema and its type drift apart
type _GameInstallMatches = Assert<
  MutuallyAssignable<z.infer<typeof gameInstallSchema>, GameInstall>
>;

export const GameInstallSchema: z.ZodType<GameInstall> = gameInstallSchema;
