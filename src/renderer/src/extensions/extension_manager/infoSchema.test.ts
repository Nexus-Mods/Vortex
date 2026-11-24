import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it, vi } from "vitest";

import { ContributesSchema } from "./contributes";
import { parseExtensionInfo } from "./extensionInfo";

vi.mock("../../logging", () => ({ log: vi.fn() }));

// The JSON Schema in @nexusmods/vortex-api is written by hand, because the value rules of
// ContributesSchema can't be expressed in it. This test is what keeps the two in agreement.
const schemaPath = resolve(
  __dirname,
  "../../../../../packages/vortex-api/schemas/info.schema.json",
);
const infoSchema = JSON.parse(readFileSync(schemaPath, "utf8")) as { examples: unknown[] };

const ajv = new Ajv2020({ strict: true, allowUnionTypes: true });
const validateSchema = ajv.compile(infoSchema);

const schemaAccepts = (info: unknown) => validateSchema(info);

/** What Vortex does with the file: loads it in manifest mode, or not at all, or in legacy mode. */
function vortexAccepts(info: unknown): boolean {
  try {
    const parsed = parseExtensionInfo(info);
    const raw = (info as { contributes?: unknown }).contributes;
    // an invalid contributes doesn't reject the extension, but it isn't a valid manifest either
    return raw === undefined || parsed.contributes !== undefined;
  } catch {
    return false;
  }
}

const base = { name: "Made-up Support", version: "1.0.0" };
const game = (fields: unknown) => ({ ...base, contributes: { games: { madeup: fields } } });
const enhancing = (...entries: unknown[]) => ({
  ...base,
  contributes: { gameEnhancements: entries },
});

describe("info.json schema and Vortex agree on shape", () => {
  const wrongShape: [string, unknown][] = [
    ["missing name", { version: "1.0.0" }],
    ["missing version", { name: "x" }],
    ["null name", { ...base, name: null }],
    ["numeric version", { ...base, version: 1 }],
    ["numeric author", { ...base, author: 5 }],
    ["numeric description", { ...base, description: 5 }],
    ["numeric id", { ...base, id: 5 }],
    ["numeric namespace", { ...base, namespace: 5 }],
    ["null contributes", { ...base, contributes: null }],
    ["string contributes", { ...base, contributes: "games" }],
    ["array contributes", { ...base, contributes: [] }],
    ["null games", { ...base, contributes: { games: null } }],
    ["array games", { ...base, contributes: { games: [] } }],
    ["string game", { ...base, contributes: { games: { madeup: "madeup" } } }],
    ["null game", { ...base, contributes: { games: { madeup: null } } }],
    ["string nexusGameId", game({ nexusGameId: "1" })],
    ["null nexusGameId", game({ nexusGameId: null })],
    ["fractional nexusGameId", game({ nexusGameId: 1.5 })],
    ["numeric gameUid", game({ gameUid: 1 })],
    ["null gameUid", game({ gameUid: null })],
    ["numeric name", game({ name: 1 })],
    ["object gameEnhancements", { ...base, contributes: { gameEnhancements: {} } }],
    ["null gameEnhancements", { ...base, contributes: { gameEnhancements: null } }],
    ["string enhancement", enhancing("abc")],
    ["null enhancement", enhancing(null)],
    ["string enhancement nexusGameId", enhancing({ nexusGameId: "130" })],
    ["numeric enhancement gameUid", enhancing({ gameUid: 1 })],
  ];

  it.each(wrongShape)("both reject %s", (_label, info) => {
    expect(vortexAccepts(info)).toBe(false);
    expect(schemaAccepts(info)).toBe(false);
  });

  // The schema leaves these to the field descriptions, so it passes what Vortex rejects.
  const wrongValue: [string, unknown][] = [
    ["a tier-0- game key", { ...base, contributes: { games: { "tier-0-made-up": {} } } }],
    ["an empty game key", { ...base, contributes: { games: { "": {} } } }],
    ["a zero nexusGameId", game({ nexusGameId: 0 })],
    ["a negative nexusGameId", game({ nexusGameId: -1 })],
    ["an empty gameUid", game({ gameUid: "" })],
    ["an empty name", game({ name: "" })],
    ["an enhancement with both targets", enhancing({ gameUid: "abc", nexusGameId: 130 })],
    ["an enhancement with no target", enhancing({})],
    ["a zero enhancement nexusGameId", enhancing({ nexusGameId: 0 })],
    ["an empty enhancement gameUid", enhancing({ gameUid: "" })],
  ];

  it.each(wrongValue)("Vortex rejects but the schema passes %s", (_label, info) => {
    expect(vortexAccepts(info)).toBe(false);
    expect(
      ContributesSchema.safeParse((info as { contributes: unknown }).contributes).success,
    ).toBe(false);
    expect(schemaAccepts(info)).toBe(true);
  });

  const accepted: [string, unknown][] = [
    ["only name and version", base],
    ["every plain field", { ...base, author: "a", description: "d", id: "i", namespace: "n" }],
    ["an empty contributes", { ...base, contributes: {} }],
    ["an empty games object", { ...base, contributes: { games: {} } }],
    ["an empty game", game({})],
    ["a full game", game({ nexusGameId: 1704, gameUid: "abc", name: "Made-up" })],
    ["an uppercase gameUid", game({ gameUid: "D88C5DE7-353B-5D60-87BE-BEC5CAA6244A" })],
    ["a tier-1- game key", { ...base, contributes: { games: { "tier-1-made-up": {} } } }],
    ["a gameUid that isn't a uuid", game({ gameUid: "not even a uuid!" })],
    ["an enhancement of one game", enhancing({ gameUid: "abc" })],
    ["an enhancement of a Nexus Mods game", enhancing({ nexusGameId: 130 })],
    ["no enhancements", enhancing()],
    ["unknown top-level keys", { ...base, somethingNew: { a: 1 } }],
    ["unknown keys in contributes", { ...base, contributes: { somethingNew: true } }],
    ["unknown keys in a game", game({ somethingNew: true })],
    ["unknown keys in an enhancement", enhancing({ nexusGameId: 130, somethingNew: true })],
    ["a $schema key", { ...base, $schema: "https://example.invalid/info.schema.json" }],
    ["any modId, which is Vortex's own", { ...base, modId: 196 }],
    ["an unusable modId, which Vortex ignores", { ...base, modId: "196" }],
    ["a null modId", { ...base, modId: null }],
  ];

  it.each(accepted)("both accept %s", (_label, info) => {
    expect(vortexAccepts(info)).toBe(true);
    expect(schemaAccepts(info)).toBe(true);
  });
});

describe("info.json schema gameId", () => {
  // Vortex has no parser for gameId. These follow the data platform's parse_game_id
  // (ingestion/sources/gamedata/tests/test_vortex_parse.py in the data repository), by hand.
  const passes: [string, unknown][] = [
    ["a number", 2304],
    ["a digit string", "2304"],
    ["a digit string with whitespace", " 2304 "],
    ["a number written with a decimal point", 2304.0],
    ["a domain", "gta5"],
    ["a mixed case domain", "fableIII"],
    ["a domain with punctuation", "steins;gateelite"],
    // shape is right, the value is one the data platform ignores
    ["zero", 0],
    ["a negative number", -5],
    ["an empty string", ""],
    ["a display name", "Game: Lockdown Protocol"],
    ["a number beyond the Nexus Mods id range", 2 ** 32],
  ];

  it.each(passes)("passes %s", (_label, gameId) => {
    expect(schemaAccepts({ ...base, gameId })).toBe(true);
  });

  const fails: [string, unknown][] = [
    ["null", null],
    ["true", true],
    ["false", false],
    ["a fraction", 2304.5],
    ["a list", [2304]],
    ["an object", { id: 2304 }],
  ];

  it.each(fails)("rejects %s", (_label, gameId) => {
    expect(schemaAccepts({ ...base, gameId })).toBe(false);
  });

  it("is marked deprecated", () => {
    const properties = (infoSchema as unknown as { properties: Record<string, object> }).properties;
    expect(properties.gameId).toMatchObject({ deprecated: true });
  });
});

describe("info.json schema examples", () => {
  it("has examples", () => {
    expect(infoSchema.examples.length).toBeGreaterThan(0);
  });

  it.each(infoSchema.examples.map((example, index) => [index, example] as const))(
    "example %i validates, and Vortex accepts it",
    (_index, example) => {
      expect(schemaAccepts(example)).toBe(true);
      expect(vortexAccepts(example)).toBe(true);
    },
  );
});
