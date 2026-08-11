import { describe, expect, it } from "vitest";

import type { ExtensionInfo, IAvailableExtension, IRegisteredExtension } from "@/types/extensions";
import type { IExtensionOptional, IExtensionState } from "@/types/IState";

import {
  findDependencyInCatalog,
  findInCatalog,
  findInstalled,
  findInstalledDependency,
  findPreviousVersions,
  findUpdatableExtensions,
  getMissingOptionalExtensions,
  isAlreadyInstalled,
  matchesQuery,
} from "./queries";

/** Helper to create a test extension state */
function makeExtensionState(overrides: Partial<IExtensionState> = {}): IExtensionState {
  return {
    enabled: true,
    remove: false,
    name: "Test Extension",
    description: "A test extension",
    author: "Test Author",
    version: "1.0.0",
    path: "/path/to/extension",
    endorsed: "Undecided",
    ...overrides,
  };
}

/** Helper to create a test available extension */
function makeAvailableExtension(overrides: Partial<IAvailableExtension> = {}): IAvailableExtension {
  return {
    name: "Test Extension",
    description: { short: "short", long: "long" },
    image: "image.png",
    author: "Test Author",
    uploader: "uploader",
    version: "1.0.0",
    downloads: 0,
    endorsements: 0,
    timestamp: 0,
    tags: [],
    ...overrides,
  };
}

/** Helper to create extension info */
function makeExtensionInfo(overrides: Partial<ExtensionInfo> = {}): ExtensionInfo {
  return {
    name: "Test Extension",
    author: "Test Author",
    description: "Test description",
    version: "1.0.0",
    ...overrides,
  };
}

/** Helper to create a registered extension */
function makeRegisteredExtension(
  overrides: Partial<IRegisteredExtension> = {},
): IRegisteredExtension {
  return {
    name: "Test Extension",
    namespace: "test-namespace",
    path: "/path/to/extension",
    dynamic: false,
    initFunc: () => () => true,
    ...overrides,
  };
}

describe("findInCatalog", () => {
  it("finds an extension by modId", () => {
    const catalog = [makeAvailableExtension({ modId: 123, fileId: 456 })];
    const result = findInCatalog(catalog, { modId: 123 });
    expect(result).toEqual(catalog[0]);
  });

  it("finds an extension by modId and fileId", () => {
    const ext1 = makeAvailableExtension({ modId: 123, fileId: 456 });
    const ext2 = makeAvailableExtension({ modId: 123, fileId: 789 });
    const catalog = [ext1, ext2];
    const result = findInCatalog(catalog, { modId: 123, fileId: 789 });
    expect(result).toEqual(ext2);
  });

  it("returns undefined when no match is found", () => {
    const catalog = [makeAvailableExtension({ modId: 123 })];
    const result = findInCatalog(catalog, { modId: 999 });
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty catalog", () => {
    const result = findInCatalog([], { modId: 123 });
    expect(result).toBeUndefined();
  });

  it("prefers exact modId and fileId match over just modId", () => {
    const ext1 = makeAvailableExtension({ modId: 123, fileId: 456 });
    const ext2 = makeAvailableExtension({ modId: 123, fileId: 789 });
    const catalog = [ext1, ext2];
    const result = findInCatalog(catalog, { modId: 123, fileId: 456 });
    expect(result).toEqual(ext1);
  });
});

describe("findInstalled", () => {
  it("finds an installed extension by modId", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123 }),
    };
    const result = findInstalled(installed, { modId: 123 });
    expect(result).toEqual({ key: "ext-1", extension: installed["ext-1"] });
  });

  it("finds an installed extension by modId and fileId", () => {
    const ext1 = makeExtensionState({ modId: 123, fileId: 456 });
    const ext2 = makeExtensionState({ modId: 123, fileId: 789 });
    const installed = {
      "ext-1": ext1,
      "ext-2": ext2,
    };
    const result = findInstalled(installed, { modId: 123, fileId: 789 });
    expect(result).toEqual({ key: "ext-2", extension: ext2 });
  });

  it("returns undefined when no match is found", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123 }),
    };
    const result = findInstalled(installed, { modId: 999 });
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty installed extensions", () => {
    const result = findInstalled({}, { modId: 123 });
    expect(result).toBeUndefined();
  });
});

describe("matchesQuery", () => {
  const query = { modId: 123, fileId: 456 };
  const state = makeExtensionState({ modId: 123, fileId: 456 });
  const available = makeAvailableExtension({ modId: 123, fileId: 456 });

  it("matches on modId alone when fileId is not specified in query", () => {
    expect(matchesQuery({ modId: 123 }, state)).toBe(true);
  });

  it("matches on modId and fileId when both are specified", () => {
    expect(matchesQuery(query, state)).toBe(true);
  });

  it("returns true for matching modId even if fileId differs", () => {
    const queryWithoutFileId = { modId: 123 };
    const stateWithDifferentFileId = makeExtensionState({ modId: 123, fileId: 789 });
    expect(matchesQuery(queryWithoutFileId, stateWithDifferentFileId)).toBe(true);
  });

  it("returns false when modId does not match", () => {
    expect(matchesQuery({ modId: 999 }, state)).toBe(false);
  });

  it("returns false when fileId matches but modId does not", () => {
    expect(matchesQuery(query, makeExtensionState({ modId: 999, fileId: 456 }))).toBe(false);
  });

  it("works with IAvailableExtension", () => {
    expect(matchesQuery(query, available)).toBe(true);
  });

  it("works with IExtensionState", () => {
    expect(matchesQuery(query, state)).toBe(true);
  });
});

describe("findDependencyInCatalog", () => {
  it("finds a dependency by id", () => {
    const ext = makeAvailableExtension({ id: "test-extension" });
    const catalog = [ext];
    const result = findDependencyInCatalog(catalog, "test-extension");
    expect(result).toEqual(ext);
  });

  it("finds a dependency by name", () => {
    const ext = makeAvailableExtension({ name: "Test Extension" });
    const catalog = [ext];
    const result = findDependencyInCatalog(catalog, "Test Extension");
    expect(result).toEqual(ext);
  });

  it("prefers id match over name match", () => {
    const ext1 = makeAvailableExtension({ id: "test-id", name: "Other Name" });
    const ext2 = makeAvailableExtension({ id: "other-id", name: "Test Name" });
    const catalog = [ext1, ext2];
    const result = findDependencyInCatalog(catalog, "test-id");
    expect(result).toEqual(ext1);
  });

  it("returns undefined when no match is found", () => {
    const catalog = [makeAvailableExtension({ id: "other-id" })];
    const result = findDependencyInCatalog(catalog, "test-id");
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty catalog", () => {
    const result = findDependencyInCatalog([], "test-id");
    expect(result).toBeUndefined();
  });
});

describe("isAlreadyInstalled", () => {
  it("returns true when the extension is installed", () => {
    const catalogEntry = makeAvailableExtension({ modId: 123, fileId: 456 });
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, fileId: 456 }),
    };
    expect(isAlreadyInstalled(installed, catalogEntry)).toBe(true);
  });

  it("returns false when the extension is not installed", () => {
    const catalogEntry = makeAvailableExtension({ modId: 123, fileId: 456 });
    const installed = {
      "ext-1": makeExtensionState({ modId: 999, fileId: 999 }),
    };
    expect(isAlreadyInstalled(installed, catalogEntry)).toBe(false);
  });

  it("returns false for empty installed extensions", () => {
    const catalogEntry = makeAvailableExtension({ modId: 123, fileId: 456 });
    expect(isAlreadyInstalled({}, catalogEntry)).toBe(false);
  });

  it("matches by both modId and fileId", () => {
    const catalogEntry = makeAvailableExtension({ modId: 123, fileId: 456 });
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, fileId: 789 }),
    };
    expect(isAlreadyInstalled(installed, catalogEntry)).toBe(false);
  });
});

describe("findInstalledDependency", () => {
  it("finds a dependency by infoJsonId", () => {
    const ext = makeExtensionState({ infoJsonId: "test-dependency" });
    const installed = { "ext-1": ext };
    const result = findInstalledDependency(installed, "test-dependency");
    expect(result).toEqual({ key: "ext-1", extension: ext });
  });

  it("finds a dependency by name", () => {
    const ext = makeExtensionState({ name: "Test Dependency" });
    const installed = { "ext-1": ext };
    const result = findInstalledDependency(installed, "Test Dependency");
    expect(result).toEqual({ key: "ext-1", extension: ext });
  });

  it("prefers infoJsonId match over name match", () => {
    const ext1 = makeExtensionState({ infoJsonId: "test-id", name: "Other Name" });
    const ext2 = makeExtensionState({ infoJsonId: "other-id", name: "Test Name" });
    const installed = { "ext-1": ext1, "ext-2": ext2 };
    const result = findInstalledDependency(installed, "test-id");
    expect(result).toEqual({ key: "ext-1", extension: ext1 });
  });

  it("returns undefined when dependency is not found", () => {
    const installed = {
      "ext-1": makeExtensionState({ infoJsonId: "other-id" }),
    };
    const result = findInstalledDependency(installed, "test-id");
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty installed extensions", () => {
    const result = findInstalledDependency({}, "test-id");
    expect(result).toBeUndefined();
  });
});

describe("findPreviousVersions", () => {
  it("finds all versions of an extension by modId", () => {
    const ext1 = makeExtensionState({ modId: 123, version: "1.0.0" });
    const ext2 = makeExtensionState({ modId: 123, version: "2.0.0" });
    const ext3 = makeExtensionState({ modId: 999, version: "1.0.0" });
    const installed = {
      "ext-1": ext1,
      "ext-2": ext2,
      "ext-3": ext3,
    };
    const catalogEntry = makeAvailableExtension({ modId: 123 });
    const result = findPreviousVersions(installed, catalogEntry);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ key: "ext-1", extension: ext1 });
    expect(result).toContainEqual({ key: "ext-2", extension: ext2 });
  });

  it("returns an empty array when no versions are found", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 999 }),
    };
    const catalogEntry = makeAvailableExtension({ modId: 123 });
    const result = findPreviousVersions(installed, catalogEntry);
    expect(result).toEqual([]);
  });

  it("returns an empty array for empty installed extensions", () => {
    const catalogEntry = makeAvailableExtension({ modId: 123 });
    const result = findPreviousVersions({}, catalogEntry);
    expect(result).toEqual([]);
  });

  it("returns all extensions with matching modId", () => {
    const versions = [
      makeExtensionState({ modId: 123, version: "1.0.0" }),
      makeExtensionState({ modId: 123, version: "1.1.0" }),
      makeExtensionState({ modId: 123, version: "2.0.0" }),
    ];
    const installed = {
      "ext-1": versions[0],
      "ext-2": versions[1],
      "ext-3": versions[2],
    };
    const catalogEntry = makeAvailableExtension({ modId: 123 });
    const result = findPreviousVersions(installed, catalogEntry);
    expect(result).toHaveLength(3);
  });
});

describe("getMissingOptionalExtensions", () => {
  it("returns empty array when all optional extensions are loaded", () => {
    const optionals: IExtensionOptional[] = [{ id: "opt1", extensionPath: "/path", args: {} }];
    const loaded: IRegisteredExtension[] = [
      makeRegisteredExtension({ info: makeExtensionInfo({ id: "opt1" }) }),
    ];
    const result = getMissingOptionalExtensions(optionals, loaded);
    expect(result).toEqual([]);
  });

  it("returns missing optional extensions by id", () => {
    const optionals: IExtensionOptional[] = [
      { id: "opt1", extensionPath: "/path", args: {} },
      { id: "opt2", extensionPath: "/path", args: {} },
    ];
    const loaded: IRegisteredExtension[] = [
      makeRegisteredExtension({ info: makeExtensionInfo({ id: "opt1" }) }),
    ];
    const result = getMissingOptionalExtensions(optionals, loaded);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("opt2");
  });

  it("matches optional extensions by name if id is not available", () => {
    const optionals: IExtensionOptional[] = [{ id: "opt-name", extensionPath: "/path", args: {} }];
    const loaded: IRegisteredExtension[] = [makeRegisteredExtension({ name: "opt-name" })];
    const result = getMissingOptionalExtensions(optionals, loaded);
    expect(result).toEqual([]);
  });

  it("returns all optionals when none are loaded", () => {
    const optionals: IExtensionOptional[] = [
      { id: "opt1", extensionPath: "/path", args: {} },
      { id: "opt2", extensionPath: "/path", args: {} },
    ];
    const loaded: IRegisteredExtension[] = [];
    const result = getMissingOptionalExtensions(optionals, loaded);
    expect(result).toEqual(optionals);
  });

  it("returns empty array for empty optionals", () => {
    const loaded: IRegisteredExtension[] = [
      makeRegisteredExtension({ info: makeExtensionInfo({ id: "opt1" }) }),
    ];
    const result = getMissingOptionalExtensions([], loaded);
    expect(result).toEqual([]);
  });

  it("prefers info.id match over name match", () => {
    const optionals: IExtensionOptional[] = [{ id: "opt-id", extensionPath: "/path", args: {} }];
    const loaded: IRegisteredExtension[] = [
      makeRegisteredExtension({
        info: makeExtensionInfo({ id: "opt-id" }),
        name: "different-name",
      }),
    ];
    const result = getMissingOptionalExtensions(optionals, loaded);
    expect(result).toEqual([]);
  });
});

describe("findUpdatableExtensions", () => {
  it("finds extensions with newer versions available", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "1.0.0" }),
    };
    const catalog = [makeAvailableExtension({ modId: 123, version: "2.0.0" })];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("ext-1");
    expect(result[0].installed.version).toBe("1.0.0");
    expect(result[0].available.version).toBe("2.0.0");
  });

  it("ignores extensions without updates available", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "2.0.0" }),
    };
    const catalog = [makeAvailableExtension({ modId: 123, version: "1.0.0" })];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toEqual([]);
  });

  it("ignores extensions with same version", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "1.0.0" }),
    };
    const catalog = [makeAvailableExtension({ modId: 123, version: "1.0.0" })];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toEqual([]);
  });

  it("ignores installed extensions not in catalog", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "1.0.0" }),
      "ext-2": makeExtensionState({ modId: 999, version: "1.0.0" }),
    };
    const catalog = [makeAvailableExtension({ modId: 123, version: "2.0.0" })];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("ext-1");
  });

  it("handles semantic versioning correctly", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "1.2.3" }),
    };
    const catalog = [makeAvailableExtension({ modId: 123, version: "1.2.4" })];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toHaveLength(1);
  });

  it("finds multiple updatable extensions", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "1.0.0" }),
      "ext-2": makeExtensionState({ modId: 456, version: "1.0.0" }),
      "ext-3": makeExtensionState({ modId: 789, version: "1.0.0" }),
    };
    const catalog = [
      makeAvailableExtension({ modId: 123, version: "2.0.0" }),
      makeAvailableExtension({ modId: 456, version: "2.0.0" }),
      makeAvailableExtension({ modId: 789, version: "1.0.0" }),
    ];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toHaveLength(2);
  });

  it("skips extensions with invalid versions", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "invalid" }),
    };
    const catalog = [makeAvailableExtension({ modId: 123, version: "2.0.0" })];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toEqual([]);
  });

  it("skips when available version is invalid", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "1.0.0" }),
    };
    const catalog = [makeAvailableExtension({ modId: 123, version: "invalid" })];
    const result = findUpdatableExtensions(installed, catalog);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty installed extensions", () => {
    const catalog = [makeAvailableExtension({ modId: 123, version: "2.0.0" })];
    const result = findUpdatableExtensions({}, catalog);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty catalog", () => {
    const installed = {
      "ext-1": makeExtensionState({ modId: 123, version: "1.0.0" }),
    };
    const result = findUpdatableExtensions(installed, []);
    expect(result).toEqual([]);
  });
});
