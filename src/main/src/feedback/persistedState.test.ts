import { describe, expect, it, vi } from "vitest";

import {
  excludedKeyPattern,
  readPersistedFeedbackState,
  type IPersistedRow,
  type ReadPersistedRows,
} from "./persistedState";

vi.mock("../logging", () => ({ log: vi.fn<() => void>() }));

const SEPARATOR = "###";

/** Whether a feedback leaves a stored key out, as DuckDB would match it against the whole key. */
const isLeftOut = (hive: string, ...path: string[]): boolean =>
  new RegExp(excludedKeyPattern(hive)).test([hive, ...path].join(SEPARATOR));

/** A store of rows by hive, read the way `readPersistedRows` reads them. */
const storeOf =
  (rows: Record<string, Record<string, unknown>>): ReadPersistedRows =>
  (hive, exclude) => {
    const pattern = new RegExp(exclude);
    return Promise.resolve(
      Object.entries(rows[hive] ?? {})
        .filter(([key]) => !pattern.test(`${hive}${SEPARATOR}${key}`))
        .map(
          ([key, value]): IPersistedRow => ({
            key: key.split(SEPARATOR),
            value: JSON.stringify(value),
          }),
        ),
    );
  };

describe("excludedKeyPattern", () => {
  it("leaves out what a mod and a download copy from Nexus Mods, and keeps their ids", () => {
    expect(isLeftOut("persistent", "mods", "skyrimse", "mod.1", "attributes", "description")).toBe(
      true,
    );
    expect(isLeftOut("persistent", "mods", "skyrimse", "mod.1", "attributes", "author")).toBe(true);
    expect(isLeftOut("persistent", "mods", "skyrimse", "mod.1", "attributes", "modId")).toBe(false);
    expect(isLeftOut("persistent", "mods", "skyrimse", "mod.1", "attributes", "fileList")).toBe(
      false,
    );

    expect(isLeftOut("persistent", "downloads", "files", "dl1", "modInfo", "meta", "x")).toBe(true);
    expect(
      isLeftOut("persistent", "downloads", "files", "dl1", "modInfo", "nexus", "modInfo"),
    ).toBe(true);
    expect(isLeftOut("persistent", "downloads", "files", "dl1", "modInfo", "nexus", "ids")).toBe(
      false,
    );
  });

  it("leaves out whole subtrees, and not a key that only starts the same", () => {
    expect(isLeftOut("persistent", "changelogs")).toBe(true);
    expect(isLeftOut("persistent", "changelogs", "1.0", "text")).toBe(true);
    expect(isLeftOut("persistent", "changelogsSeen")).toBe(false);
    expect(isLeftOut("persistent", "mods", "skyrimse", "m", "attributes", "descriptionShown")).toBe(
      false,
    );
  });

  it("leaves out the account's email address", () => {
    expect(isLeftOut("persistent", "nexus", "userInfo", "email")).toBe(true);
    expect(isLeftOut("persistent", "nexus", "userInfo", "name")).toBe(false);
  });

  it("leaves nothing out of a hive with nothing to trim", () => {
    expect(isLeftOut("settings", "window", "maximized")).toBe(false);
  });
});

describe("readPersistedFeedbackState", () => {
  it("rebuilds each hive from its rows, without what it leaves out", async () => {
    const state = await readPersistedFeedbackState(
      storeOf({
        settings: { "window###maximized": true },
        persistent: {
          "mods###skyrimse###m1###attributes###modId": 12,
          "mods###skyrimse###m1###attributes###description": "a long page",
          "mods###skyrimse###m1###rules": [{ type: "after" }],
          changelogs: [{ version: "2.12.0" }],
        },
      }),
      (text) => text,
    );

    expect(JSON.parse(JSON.stringify(state))).toEqual({
      settings: { window: { maximized: true } },
      persistent: {
        mods: { skyrimse: { m1: { attributes: { modId: 12 }, rules: [{ type: "after" }] } } },
      },
      app: {},
      user: {},
    });
  });

  it("redacts every value and key", async () => {
    const state = await readPersistedFeedbackState(
      storeOf({ settings: { "paths###/home/bob": "/home/bob/mods" } }),
      (text) => text.replaceAll("bob", "<USER>"),
    );

    expect(JSON.parse(JSON.stringify(state.settings))).toEqual({
      paths: { "/home/<USER>": "/home/<USER>/mods" },
    });
  });

  it("leaves out the email address of an account stored as one value", async () => {
    const state = await readPersistedFeedbackState(
      storeOf({
        persistent: { "nexus###userInfo": { name: "bob", email: "bob@example.com" } },
      }),
      (text) => text,
    );

    expect(JSON.parse(JSON.stringify(state.persistent))).toEqual({
      nexus: { userInfo: { name: "bob" } },
    });
  });

  it("treats a key named __proto__ as a plain key", async () => {
    const state = await readPersistedFeedbackState(
      storeOf({ settings: { "__proto__###polluted": true } }),
      (text) => text,
    );

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(JSON.stringify(state.settings)).toBe('{"__proto__":{"polluted":true}}');
  });

  it("leaves out a hive it can't read, and keeps the rest", async () => {
    const read: ReadPersistedRows = (hive, exclude) =>
      hive === "persistent"
        ? Promise.reject(new Error("locked"))
        : storeOf({ app: { instanceId: "i1" } })(hive, exclude);

    const state = await readPersistedFeedbackState(read, (text) => text);

    expect(Object.keys(state)).toEqual(["settings", "app", "user"]);
    expect(JSON.parse(JSON.stringify(state.app))).toEqual({ instanceId: "i1" });
  });
});
