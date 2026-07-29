import { z } from "zod";

/**
 * Runtime contracts for analytics events, enforced at the single send boundary in
 * MixpanelAnalytics.trackEvent.
 *
 * `MixpanelEvent.properties` is `Record<string, any>` and the event classes forward caller
 * input verbatim, so the compiler can't police a payload. The classes are also public API
 * (re-exported through util/api and vortex-api), so callers include untyped JS extensions.
 *
 * - `z.object` strips unknown keys rather than rejecting, so a stray field costs the field
 *   rather than the whole event.
 * - Nothing read from download metadata is required. Those values come from
 *   nexusIdsFromDownloadId via optional chaining and `parseInt`, and file/mod ids are
 *   legitimately absent for bundled and direct downloads, so they can be undefined or NaN
 *   at runtime despite their declared types. Only the discriminators the emit site sets
 *   from its own arguments are required: `install_kind`, `failure_stage`, `trigger`.
 * - `atLeastOneKnownField` is what keeps an empty or all-unknown payload out, so no single
 *   field has to be mandatory to reject garbage.
 *
 * The contracts are deliberately looser than the matching interfaces
 * (CollectionInstallOutcomeProps, ModAnalyticsIdentity) and so aren't tied to them with
 * `satisfies`; eventSchemas.test.ts covers drift by validating events built through the
 * real classes.
 *
 * Covers the collection-install and mod-install families. Unlisted events pass unchecked.
 */

/** Producers derive these by arithmetic or `parseInt`, so NaN is reachable. */
const analyticsNumber = z.number().or(z.nan());

/** Rejects a payload that retained none of its recognized properties. */
function atLeastOneKnownField<T extends z.ZodObject>(schema: T) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    message: "no recognized analytics properties present",
  });
}

/** Count/duration snapshot shared by every collection-install event. */
const collectionInstallOutcome = z.object({
  collection_id: z.string().optional(),
  revision_id: z.string().optional(),
  game_id: analyticsNumber.optional(),
  required_total: analyticsNumber.optional(),
  installed: analyticsNumber.optional(),
  failed: analyticsNumber.optional(),
  ignored: analyticsNumber.optional(),
  optional: analyticsNumber.optional(),
  duration_ms: analyticsNumber.optional(),
  total_duration_ms: analyticsNumber.optional(),
  pause_count: analyticsNumber.optional(),
  resume_count: analyticsNumber.optional(),
  was_resumed: z.boolean().optional(),
});

/** Identity shared by every per-mod event. Null collection/revision means "not part of a collection". */
const modAnalyticsIdentity = z.object({
  mod_id: z.string().optional(),
  file_id: z.string().optional(),
  game_id: analyticsNumber.optional(),
  mod_uid: z.string().optional(),
  file_uid: z.string().optional(),
  collection_id: z.string().nullable().optional(),
  revision_id: z.string().nullable().optional(),
});

/** Identity plus how the install came about, shared by the mods_installation_* events. */
const modInstall = modAnalyticsIdentity.extend({
  install_kind: z.enum(["fresh", "version_update", "reinstall", "variant", "profile_replace"]),
});

/**
 * eventName -> contract. An absent event is sent unvalidated, which is how the families
 * not yet migrated keep working; `hasEventSchema` lets tests track coverage.
 */
export const EVENT_SCHEMAS: Record<string, z.ZodType> = {
  collections_installation_started: atLeastOneKnownField(
    collectionInstallOutcome.extend({ mod_count: analyticsNumber.optional() }),
  ),
  collections_installation_resumed: atLeastOneKnownField(collectionInstallOutcome),
  collections_installation_completed: atLeastOneKnownField(
    collectionInstallOutcome.extend({ mod_count: analyticsNumber.optional() }),
  ),
  collections_installation_failed: atLeastOneKnownField(
    collectionInstallOutcome.extend({
      failure_stage: z.enum(["member_install", "postprocessing"]),
      error_code: z.string().optional(),
    }),
  ),
  collections_installation_cancelled: atLeastOneKnownField(collectionInstallOutcome),
  collections_installation_paused: atLeastOneKnownField(
    collectionInstallOutcome.extend({ trigger: z.string() }),
  ),

  mods_installation_started: atLeastOneKnownField(modInstall),
  mods_installation_completed: atLeastOneKnownField(
    modInstall.extend({ duration_ms: analyticsNumber.optional() }),
  ),
  mods_installation_cancelled: atLeastOneKnownField(modInstall),
  mods_installation_failed: atLeastOneKnownField(
    modInstall.extend({ error_code: z.string(), error_message: z.string() }),
  ),
};

export type EventValidation =
  | { status: "valid"; properties: Record<string, unknown> }
  | { status: "invalid"; error: z.ZodError }
  /** No contract registered for this event name; send the payload as-is. */
  | { status: "unchecked" };

/**
 * Validates an event's properties against its contract, returning the payload with unknown
 * keys stripped. Rejects a payload that isn't an object, retained no recognized property,
 * or mistypes a discriminator: such a row can't be joined to its related events and skews
 * the funnels, which is worse than no row.
 */
export function validateEventProperties(eventName: string, properties: unknown): EventValidation {
  const schema = EVENT_SCHEMAS[eventName];
  if (schema === undefined) {
    return { status: "unchecked" };
  }
  const result = schema.safeParse(properties);
  return result.success
    ? { status: "valid", properties: result.data as Record<string, unknown> }
    : { status: "invalid", error: result.error };
}

/** Whether a contract is registered for this event name. */
export function hasEventSchema(eventName: string): boolean {
  return EVENT_SCHEMAS[eventName] !== undefined;
}
