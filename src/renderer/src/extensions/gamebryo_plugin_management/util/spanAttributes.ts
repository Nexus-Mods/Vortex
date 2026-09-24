/**
 * Every span attribute this extension records. One spelling per fact, so a new call site reuses
 * a name instead of inventing a near-miss that reads as a separate field in ClickStack.
 */
export const SpanAttribute = {
  /** Fault classification. */
  ErrorCode: "error.code",

  /** The libloot call a failure came from. */
  LootKind: "loot.kind",
  LootPhase: "loot.phase",
  LootCall: "loot.call",
  LootErrorCode: "loot.error_code",
  LootExitCode: "loot.exit_code",
  LootFrameBytes: "loot.frame_bytes",
  LootGameMode: "loot.gamemode",
  LootRecovering: "loot.recovering",
  LootRestartsLeft: "loot.restarts_left",
  LootSortRequested: "loot.sort_requested",

  /** The plugin a signal is about, and the list it sits in. */
  PluginName: "plugin.name",
  PluginModId: "plugin.mod_id",
  PluginFileId: "plugin.file_id",
  PluginCollection: "plugin.collection",
  PluginCount: "plugin.count",
  PluginFormat: "plugin.format",

  /** The master that plugin could not load. */
  MasterName: "master.name",
  MasterState: "master.state",
  MasterModId: "master.mod_id",
  MasterFileId: "master.file_id",
  MasterCollection: "master.collection",
  MasterModEnabled: "master.mod_enabled",
  MasterSameCollection: "master.same_collection",

  /** How much of the loadout the signal covers. */
  MissingCount: "missing.count",
  MissingContradicting: "missing.contradicting",
  CollectionsEnabled: "collections.enabled",
  CollectionsCount: "collections.count",
} as const;

export type SpanAttribute = (typeof SpanAttribute)[keyof typeof SpanAttribute];

/**
 * The keys above that are set once through setErrorContext instead of per span, so they ride on
 * every error span for the rest of the session. errorHandling prefixes them with "context.".
 */
export const AMBIENT_ATTRIBUTES = [SpanAttribute.PluginCount, SpanAttribute.PluginFormat] as const;

/** Span attributes as they are assembled, before the absent ones are dropped. */
export type SpanAttributes = Partial<Record<SpanAttribute, string | number | boolean | undefined>>;

/** The attributes that carry a value, which is all recordErrorSpan accepts. */
export function definedAttributes(
  attributes: SpanAttributes,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
    ),
  );
}
