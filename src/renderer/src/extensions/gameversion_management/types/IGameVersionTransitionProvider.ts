export interface IGameVersionTransitionCatalogSource {
  url: string;
  trustedKeys: Record<string, string>;
}

export interface IGameVersionTransitionProvider {
  id: string;
  priority: number;
  supportedGames: string[];
  supportedStores: string[];
  supportedPlatforms: NodeJS.Platform[];
  catalog: IGameVersionTransitionCatalogSource;
  launchMode: "direct";
}

export type GameVersionPatchAlgorithm = "bsdiff40-v1" | "chunk-map-v1";

export interface IGameVersionFingerprintFile {
  path: string;
  sha256: string;
  size?: number;
}

export interface IGameVersionFingerprint {
  files: IGameVersionFingerprintFile[];
}

export interface IGameVersionArtifact {
  url: string;
  sha256: string;
  size: number;
}

export interface IGameVersionPatchOperation {
  type: "patch";
  algorithm: GameVersionPatchAlgorithm;
  sourcePath: string;
  targetPath: string;
  sourceSha256: string;
  targetSha256: string;
  targetSize: number;
  artifact: IGameVersionArtifact;
}

export interface IGameVersionRemoveOperation {
  type: "remove";
  targetPath: string;
}

export type GameVersionTransitionOperation =
  | IGameVersionPatchOperation
  | IGameVersionRemoveOperation;

export interface IGameVersionTransition {
  source: IGameVersionFingerprint;
  operations: GameVersionTransitionOperation[];
}

export interface IGameVersionTarget {
  version: string;
  aliases?: string[];
  compatibilityNote?: string;
  fingerprint: IGameVersionFingerprint;
  transitions: IGameVersionTransition[];
}

export interface IGameVersionCatalogGame {
  gameId: string;
  store: string;
  appId?: string;
  targets: IGameVersionTarget[];
}

export interface IGameVersionCatalog {
  schemaVersion: 1;
  providerId: string;
  games: IGameVersionCatalogGame[];
}

export interface ISignedGameVersionCatalog {
  schemaVersion: 1;
  keyId: string;
  payload: string;
  signature: string;
}
