import { describe, expect, it } from "vitest";

import { EVENT_SCHEMAS, hasEventSchema, validateEventProperties } from "./eventSchemas";
import type { CollectionInstallOutcomeProps, ModAnalyticsIdentity } from "./MixpanelEvents";
import {
  CollectionsInstallationCancelledEvent,
  CollectionsInstallationCompletedEvent,
  CollectionsInstallationFailedEvent,
  CollectionsInstallationPausedEvent,
  CollectionsInstallationResumedEvent,
  CollectionsInstallationStartedEvent,
  ModsInstallationCancelledEvent,
  ModsInstallationCompletedEvent,
  ModsInstallationFailedEvent,
  ModsInstallationStartedEvent,
} from "./MixpanelEvents";

const outcomeProps: CollectionInstallOutcomeProps = {
  collection_id: "479609",
  revision_id: "12345",
  game_id: 1704,
  required_total: 10,
  installed: 8,
  failed: 2,
  ignored: 0,
  optional: 3,
  duration_ms: 1000,
  total_duration_ms: 2000,
  pause_count: 1,
  resume_count: 1,
  was_resumed: true,
};

const modIdentity: ModAnalyticsIdentity = {
  mod_id: "123",
  file_id: "456",
  game_id: 1704,
  mod_uid: "mod-uid",
  file_uid: "file-uid",
  collection_id: "479609",
  revision_id: "12345",
};

const modInstallProps = { ...modIdentity, install_kind: "fresh" as const };

describe("validateEventProperties", () => {
  // Regression: a collections_installation_failed row reached Mixpanel in 2.4.0 as
  // {"0":"4","1":"7",...}, a bare id string spread into the properties object.
  it("rejects a bare string passed as the properties", () => {
    const result = validateEventProperties("collections_installation_failed", "479609");
    expect(result.status).toBe("invalid");
  });

  it("rejects a string that was spread into an object", () => {
    const spread = { ...("479609" as unknown as object) };
    const result = validateEventProperties("collections_installation_failed", spread);
    expect(result.status).toBe("invalid");
  });

  it.each([null, undefined, 42, [], true])("rejects non-object properties: %s", (properties) => {
    expect(validateEventProperties("collections_installation_failed", properties).status).toBe(
      "invalid",
    );
  });

  it("rejects an empty object, so a fully stripped payload can't pass as valid", () => {
    expect(validateEventProperties("collections_installation_cancelled", {}).status).toBe(
      "invalid",
    );
  });

  it("rejects a payload whose every key is unrecognized", () => {
    expect(
      validateEventProperties("collections_installation_cancelled", { 0: "4", 1: "7" }).status,
    ).toBe("invalid");
  });

  it("accepts a collection event carrying only part of the snapshot", () => {
    // no id is mandatory, so one recognized field is enough
    expect(
      validateEventProperties("collections_installation_cancelled", { duration_ms: 1000 }).status,
    ).toBe("valid");
  });

  it("rejects a payload with a mistyped field", () => {
    const result = validateEventProperties("collections_installation_cancelled", {
      ...outcomeProps,
      collection_id: 479609, // number where the contract says string
    });
    expect(result.status).toBe("invalid");
  });

  it("tolerates a missing file_id, absent for bundled and direct downloads", () => {
    const { file_id: _omitted, ...withoutFileId } = modInstallProps;
    expect(validateEventProperties("mods_installation_started", { ...withoutFileId }).status).toBe(
      "valid",
    );
  });

  it("rejects a value outside a closed vocabulary", () => {
    const result = validateEventProperties("collections_installation_failed", {
      ...outcomeProps,
      failure_stage: "something_else",
    });
    expect(result.status).toBe("invalid");
  });

  it("strips unknown keys rather than rejecting the event", () => {
    const result = validateEventProperties("collections_installation_cancelled", {
      ...outcomeProps,
      junk: "should not reach mixpanel",
      0: "4",
    });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.properties).toEqual({ ...outcomeProps });
    expect(result.properties).not.toHaveProperty("junk");
    expect(result.properties).not.toHaveProperty("0");
  });

  it("keeps a registered optional field when present", () => {
    const result = validateEventProperties("collections_installation_failed", {
      ...outcomeProps,
      failure_stage: "postprocessing",
      error_code: "EPERM",
    });
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.properties.error_code).toBe("EPERM");
  });

  it("reports an unregistered event name as unchecked so it is still sent", () => {
    expect(validateEventProperties("app_launched", { anything: 1 }).status).toBe("unchecked");
  });

  it("allows a null collection_id on a mod installed outside a collection", () => {
    const result = validateEventProperties("mods_installation_started", {
      ...modInstallProps,
      collection_id: null,
      revision_id: null,
    });
    expect(result.status).toBe("valid");
  });

  // Read through optional chaining / parseInt, so undefined and NaN are reachable at
  // runtime despite the declared types. Rejecting on those would drop good events.
  it("tolerates a missing revision_id, which buildOutcomeProps does not guard", () => {
    const { revision_id: _omitted, ...withoutRevision } = outcomeProps;
    expect(
      validateEventProperties("collections_installation_cancelled", { ...withoutRevision }).status,
    ).toBe("valid");
  });

  it("tolerates a NaN game_id, which parseInt can produce", () => {
    const result = validateEventProperties("collections_installation_cancelled", {
      ...outcomeProps,
      game_id: NaN,
    });
    expect(result.status).toBe("valid");
  });

  it("tolerates a missing mod_id, which resolveModIdentity does not guard", () => {
    const { mod_id: _omitted, ...withoutModId } = modInstallProps;
    expect(validateEventProperties("mods_installation_started", { ...withoutModId }).status).toBe(
      "valid",
    );
  });

  it("still rejects a mistyped install_kind", () => {
    expect(
      validateEventProperties("mods_installation_started", {
        ...modInstallProps,
        install_kind: "made_up",
      }).status,
    ).toBe("invalid");
  });
});

describe("event schema coverage", () => {
  // Built through the real event classes so a renamed event, or a field a schema gets
  // wrong, fails here rather than dropping real events in production.
  const covered = [
    new CollectionsInstallationStartedEvent(outcomeProps),
    new CollectionsInstallationResumedEvent(outcomeProps),
    new CollectionsInstallationCompletedEvent(outcomeProps),
    new CollectionsInstallationFailedEvent({
      ...outcomeProps,
      failure_stage: "member_install",
    }),
    new CollectionsInstallationCancelledEvent(outcomeProps),
    new CollectionsInstallationPausedEvent({ ...outcomeProps, trigger: "user" }),
    new ModsInstallationStartedEvent(modInstallProps),
    new ModsInstallationCompletedEvent({ ...modInstallProps, duration_ms: 500 }),
    new ModsInstallationCancelledEvent(modInstallProps),
    new ModsInstallationFailedEvent({
      ...modInstallProps,
      error_code: "EPERM",
      error_message: "denied",
    }),
  ];

  it.each(covered.map((event) => [event.eventName, event] as const))(
    "%s has a registered schema",
    (_name, event) => {
      expect(hasEventSchema(event.eventName)).toBe(true);
    },
  );

  it.each(covered.map((event) => [event.eventName, event] as const))(
    "%s validates as its class constructs it",
    (_name, event) => {
      const result = validateEventProperties(event.eventName, event.properties);
      expect(result.status).toBe("valid");
    },
  );

  // Unknown keys are stripped, so a property a producer emits but its schema omits would
  // disappear from the dataset with no other signal.
  it.each(covered.map((event) => [event.eventName, event] as const))(
    "%s keeps every property its class emits",
    (_name, event) => {
      const result = validateEventProperties(event.eventName, event.properties);
      expect(result.status).toBe("valid");
      if (result.status !== "valid") return;
      expect(Object.keys(result.properties).sort()).toEqual(Object.keys(event.properties).sort());
    },
  );

  it("registers a schema for every covered event and nothing else", () => {
    expect(Object.keys(EVENT_SCHEMAS).sort()).toEqual(covered.map((e) => e.eventName).sort());
  });
});
