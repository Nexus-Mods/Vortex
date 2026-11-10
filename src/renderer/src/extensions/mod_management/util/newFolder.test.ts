import { relativePath } from "@nexusmods/paths";
import { describe, expect, it } from "vitest";

import {
  folderNameProblem,
  removeCreated,
  removeOpen,
  renameCreated,
  renameOpen,
  uniqueFolderName,
} from "./newFolder";

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

const paths = (...names: string[]) => names.map((name) => relativePath(name));

describe("renameCreated", () => {
  it("renames the folder and the folders below it", () => {
    expect(
      renameCreated(paths("A", "A/C", "A/C/D", "Other"), relativePath("A"), relativePath("B")),
    ).toEqual(paths("B", "B/C", "B/C/D", "Other"));
  });

  it("renames a folder inside another", () => {
    expect(renameCreated(paths("X/A", "X/A/C"), relativePath("X/A"), relativePath("X/B"))).toEqual(
      paths("X/B", "X/B/C"),
    );
  });

  it("leaves a folder that only starts with the same letters", () => {
    expect(renameCreated(paths("A", "AB", "AB/C"), relativePath("A"), relativePath("B"))).toEqual(
      paths("B", "AB", "AB/C"),
    );
  });
});

describe("removeCreated", () => {
  it("removes the folder and the folders below it", () => {
    expect(removeCreated(paths("A", "A/C", "Other"), relativePath("A"))).toEqual(paths("Other"));
  });

  it("keeps a folder that only starts with the same letters", () => {
    expect(removeCreated(paths("A", "AB"), relativePath("A"))).toEqual(paths("AB"));
  });
});

describe("renameOpen and removeOpen", () => {
  it("move and drop the paths below the folder, as for the created folders", () => {
    const open = new Set(paths("", "A", "A/C", "Other"));

    expect(renameOpen(open, relativePath("A"), relativePath("B"))).toEqual(
      new Set(paths("", "B", "B/C", "Other")),
    );
    expect(removeOpen(open, relativePath("A"))).toEqual(new Set(paths("", "Other")));
  });
});
