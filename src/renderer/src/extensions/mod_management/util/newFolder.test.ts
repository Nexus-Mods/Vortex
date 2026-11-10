import { describe, expect, it } from "vitest";

import { folderNameProblem, uniqueFolderName } from "./newFolder";

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

describe("folderNameProblem", () => {
  it("takes an ordinary name", () => {
    expect(folderNameProblem("Textures", [])).toBeUndefined();
    expect(folderNameProblem("My Mod 2", ["Data"])).toBeUndefined();
    expect(folderNameProblem(".hidden", [])).toBeUndefined();
  });

  it("trims the name before judging it", () => {
    expect(folderNameProblem("  Textures  ", [])).toBeUndefined();
    expect(folderNameProblem("   ", [])).toBe("empty");
  });

  it("reports an empty name", () => {
    expect(folderNameProblem("", [])).toBe("empty");
  });

  it("reports the names of the current and the parent directory", () => {
    expect(folderNameProblem(".", [])).toBe("dot");
    expect(folderNameProblem("..", [])).toBe("dot");
  });

  it("reports a name that would be a path", () => {
    expect(folderNameProblem("a/b", [])).toBe("invalidCharacter");
    expect(folderNameProblem("a\\b", [])).toBe("invalidCharacter");
  });

  it("reports characters a Windows name can't have", () => {
    for (const character of [":", "*", "?", '"', "<", ">", "|"]) {
      expect(folderNameProblem(`a${character}b`, [])).toBe("invalidCharacter");
    }
  });

  it("reports control characters", () => {
    expect(folderNameProblem("a\u0000b", [])).toBe("invalidCharacter");
    expect(folderNameProblem("a\tb", [])).toBe("invalidCharacter");
  });

  it("reports a name ending in a dot", () => {
    expect(folderNameProblem("name.", [])).toBe("trailingDot");
  });

  it("reports a name a sibling has, without regard to case", () => {
    expect(folderNameProblem("Data", ["Data"])).toBe("taken");
    expect(folderNameProblem("data", ["DATA"])).toBe("taken");
    expect(folderNameProblem(" Data ", ["Data"])).toBe("taken");
  });

  it("reports the first problem when there are several", () => {
    expect(folderNameProblem("a/b.", [])).toBe("invalidCharacter");
    expect(folderNameProblem("a.", ["a."])).toBe("trailingDot");
  });
});
