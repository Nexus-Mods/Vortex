import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeSilentVerifier } from "../test-utils/builders";
import { makeTempDir } from "../test-utils/tempDir";
import type { IReducerSpec } from "../types/IExtensionContext";
import {
  buildReducerTree,
  Decision,
  deriveReducer,
  sanitizeHydrationState,
  STATE_BACKUP_PATH,
} from "./index";

// repairing writes a backup of the stored state under the temp path
const paths = vi.hoisted(() => ({ root: "" }));
vi.mock("../util/getVortexPath", () => ({ default: () => paths.root }));

beforeEach(async () => {
  paths.root = await makeTempDir("vortex-hydration-");
});

// a slice whose records carry a list that hydration may drop; keyed by record id
const recordsSpec: IReducerSpec = {
  reducers: {},
  defaults: {},
  verifiers: {
    _: {
      description: () => "invalid record",
      type: "object",
      deleteBroken: true,
      elements: {
        list: makeSilentVerifier({ description: () => "record has no list" }),
        name: {
          description: () => "record has no name",
          type: "string",
          required: true,
          repair: () => "<Invalid>",
        },
      },
    },
  },
};

const tree = buildReducerTree([{ path: ["persistent", "records"], reducer: recordsSpec }]);

async function readBackup(): Promise<unknown> {
  const backupDir = path.join(paths.root, STATE_BACKUP_PATH);
  const [backupFile] = await readdir(backupDir);
  return JSON.parse(await readFile(path.join(backupDir, backupFile), "utf-8")) as unknown;
}

describe("sanitizeHydrationState", () => {
  it("applies silent repairs without asking", async () => {
    const queryDecision = vi.fn(() => Promise.resolve(Decision.SANITIZE));

    const result = await sanitizeHydrationState(
      tree,
      { persistent: { records: { a: { name: "A" } } } } as never,
      queryDecision,
    );

    expect(result).toEqual({ persistent: { records: { a: { name: "A", list: {} } } } });
    expect(queryDecision).not.toHaveBeenCalled();
  });

  it("keeps silent repairs when the user ignores a reported problem in the same slice", async () => {
    const result = await sanitizeHydrationState(
      tree,
      { persistent: { records: { a: { name: "A" }, b: { list: {} } } } } as never,
      () => Promise.resolve(Decision.IGNORE),
    );

    expect(result).toEqual({
      persistent: { records: { a: { name: "A", list: {} }, b: { list: {} } } },
    });
  });

  it("applies silent and reported repairs when the user repairs, backing up the stored state", async () => {
    const stored = { persistent: { records: { a: { name: "A" }, b: { list: {} } } } };

    const result = await sanitizeHydrationState(tree, stored as never, () =>
      Promise.resolve(Decision.SANITIZE),
    );

    expect(result).toEqual({
      persistent: { records: { a: { name: "A", list: {} }, b: { list: {}, name: "<Invalid>" } } },
    });
    expect(await readBackup()).toEqual(stored);
  });

  it("asks before repairing a problem that is not silent", async () => {
    const queryDecision = vi.fn(() => Promise.resolve(Decision.IGNORE));

    await sanitizeHydrationState(
      tree,
      { persistent: { records: { a: { list: {} } } } } as never,
      queryDecision,
    );

    expect(queryDecision).toHaveBeenCalledWith(["record has no name"]);
  });

  it("asks before replacing a value that is present but invalid", async () => {
    const queryDecision = vi.fn(() => Promise.resolve(Decision.IGNORE));

    await sanitizeHydrationState(
      tree,
      { persistent: { records: { a: { name: "A", list: "corrupt" } } } } as never,
      queryDecision,
    );

    expect(queryDecision).toHaveBeenCalledWith(["record has no list"]);
  });

  it("leaves a record that is not an object to the reported checks", async () => {
    const queryDecision = vi.fn(() => Promise.resolve(Decision.IGNORE));

    const result = await sanitizeHydrationState(
      tree,
      { persistent: { records: { a: "corrupt", b: { name: "B" } } } } as never,
      queryDecision,
    );

    expect(result).toEqual({
      persistent: { records: { a: "corrupt", b: { name: "B", list: {} } } },
    });
    expect(queryDecision).toHaveBeenCalledWith(["invalid record"]);
  });
});

describe("deriveReducer", () => {
  it("applies silent repairs on hydration without asking", () => {
    const querySanitize = vi.fn(() => Decision.SANITIZE);
    const reducer = deriveReducer("", tree, querySanitize, () => undefined);

    const state = reducer(undefined, {
      type: "__hydrate",
      payload: { persistent: { records: { a: { name: "A" } } } },
    }) as { persistent: { records: unknown } };

    expect(state.persistent.records).toEqual({ a: { name: "A", list: {} } });
    expect(querySanitize).not.toHaveBeenCalled();
  });

  it("keeps silent repairs on hydration when the user ignores a reported problem", () => {
    const reducer = deriveReducer(
      "",
      tree,
      () => Decision.IGNORE,
      () => undefined,
    );

    const state = reducer(undefined, {
      type: "__hydrate",
      payload: { persistent: { records: { a: { name: "A" }, b: { list: {} } } } },
    }) as { persistent: { records: unknown } };

    expect(state.persistent.records).toEqual({ a: { name: "A", list: {} }, b: { list: {} } });
  });

  it("backs up the stored payload when repairing on hydration", async () => {
    const stored = { persistent: { records: { a: { name: "A" }, b: { list: {} } } } };
    const reducer = deriveReducer(
      "",
      tree,
      () => Decision.SANITIZE,
      () => undefined,
    );

    reducer(undefined, { type: "__hydrate", payload: stored });

    expect(await readBackup()).toEqual(stored);
  });
});
