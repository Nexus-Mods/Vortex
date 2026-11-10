import { describe, expect, it } from "vitest";

import { isValidFolderName, uniqueFolderName } from "./newFolder";

describe("uniqueFolderName", () => {
  it("is the base when nothing has it", () => {
    expect(uniqueFolderName("New folder", [])).toBe("New folder");
    expect(uniqueFolderName("New folder", ["Data", "Mods"])).toBe("New folder");
  });

  it("numbers the name from 2 when the base is taken", () => {
    expect(uniqueFolderName("New folder", ["New folder"])).toBe("New folder 2");
  });

  it("takes the first number that is free", () => {
    expect(uniqueFolderName("New folder", ["New folder", "New folder 2", "New folder 4"])).toBe(
      "New folder 3",
    );
  });

  it("matches taken names without regard to case", () => {
    expect(uniqueFolderName("New folder", ["new FOLDER"])).toBe("New folder 2");
  });

  it("takes any iterable of names", () => {
    expect(uniqueFolderName("New folder", new Set(["New folder"]))).toBe("New folder 2");
  });
});

describe("isValidFolderName", () => {
  it("takes an ordinary name", () => {
    expect(isValidFolderName("Textures", [])).toBe(true);
    expect(isValidFolderName("My Mod 2", ["Data"])).toBe(true);
    expect(isValidFolderName(".hidden", [])).toBe(true);
  });

  it("trims the name before judging it", () => {
    expect(isValidFolderName("  Textures  ", [])).toBe(true);
    expect(isValidFolderName("   ", [])).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(isValidFolderName("", [])).toBe(false);
  });

  it("rejects the names of the current and the parent directory", () => {
    expect(isValidFolderName(".", [])).toBe(false);
    expect(isValidFolderName("..", [])).toBe(false);
  });

  it("rejects a name that would be a path", () => {
    expect(isValidFolderName("a/b", [])).toBe(false);
    expect(isValidFolderName("a\\b", [])).toBe(false);
  });

  it("rejects characters a Windows name can't have", () => {
    for (const character of [":", "*", "?", '"', "<", ">", "|"]) {
      expect(isValidFolderName(`a${character}b`, [])).toBe(false);
    }
  });

  it("rejects control characters", () => {
    expect(isValidFolderName("a\u0000b", [])).toBe(false);
    expect(isValidFolderName("a\tb", [])).toBe(false);
  });

  it("rejects a name ending in a dot", () => {
    expect(isValidFolderName("name.", [])).toBe(false);
  });

  it("rejects a name a sibling has, without regard to case", () => {
    expect(isValidFolderName("Data", ["Data"])).toBe(false);
    expect(isValidFolderName("data", ["DATA"])).toBe(false);
    expect(isValidFolderName(" Data ", ["Data"])).toBe(false);
  });
});
