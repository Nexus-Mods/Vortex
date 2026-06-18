import { describe, it, expect } from "vitest";

import { installPortrait, installVoice } from "./hooks";

type Inst = { type: string; source?: string; destination?: string; value?: unknown };
const copies = (result: { instructions: Inst[] }): Inst[] =>
  result.instructions.filter((i) => i.type === "copy");
const modType = (result: { instructions: Inst[] }): unknown =>
  result.instructions.find((i) => i.type === "setmodtype")?.value;

describe("installPortrait", () => {
  it("deploys a single named portrait folder under the portrait mod type", async () => {
    const result = await installPortrait(
      ["9999/Fulllength.png", "9999/Medium.png", "9999/Small.png", "9999/Thumbs.db"],
      "/staging/x.installing",
    );
    expect(modType(result)).toBe("portrait");
    expect(copies(result)).toEqual([
      { type: "copy", source: "9999/Fulllength.png", destination: "9999/Fulllength.png" },
      { type: "copy", source: "9999/Medium.png", destination: "9999/Medium.png" },
      { type: "copy", source: "9999/Small.png", destination: "9999/Small.png" },
    ]);
  });

  it("keeps every portrait in a multi-portrait Portraits/ wrapper, stripping the wrapper", async () => {
    const result = await installPortrait(
      [
        "Portraits/001Mercy/Fulllength.png",
        "Portraits/001Mercy/Medium.png",
        "Portraits/001Mercy/Small.png",
        "Portraits/002Mercy/Fulllength.png",
        "Portraits/002Mercy/Medium.png",
        "Portraits/002Mercy/Small.png",
      ],
      "/staging/x",
    );
    const dests = copies(result)
      .map((c) => c.destination)
      .sort();
    expect(dests).toEqual([
      "001Mercy/Fulllength.png",
      "001Mercy/Medium.png",
      "001Mercy/Small.png",
      "002Mercy/Fulllength.png",
      "002Mercy/Medium.png",
      "002Mercy/Small.png",
    ]);
  });

  it("synthesises a folder name for a loose-at-root portrait and drops non-images", async () => {
    const result = await installPortrait(
      ["Fulllength.png", "Medium.png", "Small.png", "Readme.txt"],
      "/staging/Concept_Art_Linzi.installing",
    );
    expect(copies(result)).toEqual([
      { type: "copy", source: "Fulllength.png", destination: "Concept_Art_Linzi/Fulllength.png" },
      { type: "copy", source: "Medium.png", destination: "Concept_Art_Linzi/Medium.png" },
      { type: "copy", source: "Small.png", destination: "Concept_Art_Linzi/Small.png" },
    ]);
  });

  it("takes only the immediate portrait folder regardless of nesting depth", async () => {
    const result = await installPortrait(
      ["Mod/sub/Name/Fulllength.png", "Mod/sub/Name/Medium.png", "Mod/sub/Name/Small.png"],
      "/staging/x",
    );
    expect(copies(result).map((c) => c.destination)).toEqual([
      "Name/Fulllength.png",
      "Name/Medium.png",
      "Name/Small.png",
    ]);
  });
});

describe("installVoice", () => {
  it("flattens a single .bnk into the audio folder and tags the voice mod type", async () => {
    const result = await installVoice(
      ["Vax (Madman)/PC_Male_Madman_GVR_ENG.bnk", "Readme.txt"],
      "/staging/x.installing",
    );
    expect(modType(result)).toBe("voice");
    expect(copies(result)).toEqual([
      {
        type: "copy",
        source: "Vax (Madman)/PC_Male_Madman_GVR_ENG.bnk",
        destination: "PC_Male_Madman_GVR_ENG.bnk",
      },
    ]);
  });

  it("flattens several distinct banks regardless of nesting", async () => {
    const result = await installVoice(["Voices/Angelina/A.bnk", "Voices/Chen/B.bnk"], "/staging/x");
    expect(copies(result).map((c) => c.destination)).toEqual(["A.bnk", "B.bnk"]);
  });

  it("defers a multi-variant pack to the Mods folder with no voice mod type", async () => {
    const result = await installVoice(
      ["magic goblin/PC_Male_Madman_GVR_ENG.bnk", "stabby goblin/PC_Male_Madman_GVR_ENG.bnk"],
      "/staging/x",
    );
    expect(modType(result)).toBeUndefined();
    expect(copies(result).map((c) => c.destination)).toEqual([
      "magic goblin/PC_Male_Madman_GVR_ENG.bnk",
      "stabby goblin/PC_Male_Madman_GVR_ENG.bnk",
    ]);
  });
});
