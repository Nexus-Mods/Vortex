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
      [
        "Camellia/Fulllength.png",
        "Camellia/Medium.png",
        "Camellia/Small.png",
        "Camellia/Thumbs.db",
      ],
      "/staging/x.installing",
    );
    expect(modType(result)).toBe("portrait");
    expect(copies(result)).toEqual([
      { type: "copy", source: "Camellia/Fulllength.png", destination: "Camellia/Fulllength.png" },
      { type: "copy", source: "Camellia/Medium.png", destination: "Camellia/Medium.png" },
      { type: "copy", source: "Camellia/Small.png", destination: "Camellia/Small.png" },
    ]);
  });

  it("keeps every portrait in a multi-portrait Portraits/ wrapper, stripping the wrapper", async () => {
    const result = await installPortrait(
      [
        "Portraits/Angel/Fulllength.png",
        "Portraits/Angel/Medium.png",
        "Portraits/Angel/Small.png",
        "Portraits/Demon/Fulllength.png",
        "Portraits/Demon/Medium.png",
        "Portraits/Demon/Small.png",
      ],
      "/staging/x",
    );
    const dests = copies(result)
      .map((c) => c.destination)
      .sort();
    expect(dests).toEqual([
      "Angel/Fulllength.png",
      "Angel/Medium.png",
      "Angel/Small.png",
      "Demon/Fulllength.png",
      "Demon/Medium.png",
      "Demon/Small.png",
    ]);
  });

  it("synthesises a folder name for a loose-at-root portrait and drops non-images", async () => {
    const result = await installPortrait(
      ["Fulllength.png", "Medium.png", "Small.png", "Readme.txt"],
      "/staging/Camellia_Remastered.installing",
    );
    expect(copies(result)).toEqual([
      { type: "copy", source: "Fulllength.png", destination: "Camellia_Remastered/Fulllength.png" },
      { type: "copy", source: "Medium.png", destination: "Camellia_Remastered/Medium.png" },
      { type: "copy", source: "Small.png", destination: "Camellia_Remastered/Small.png" },
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
      ["Alistair Voice Pack/PC_Male_Optimist_GVR_ENG.bnk", "Readme.txt"],
      "/staging/x.installing",
    );
    expect(modType(result)).toBe("voice");
    expect(copies(result)).toEqual([
      {
        type: "copy",
        source: "Alistair Voice Pack/PC_Male_Optimist_GVR_ENG.bnk",
        destination: "PC_Male_Optimist_GVR_ENG.bnk",
      },
    ]);
  });

  it("flattens several distinct banks regardless of nesting", async () => {
    const result = await installVoice(
      [
        "WOTR Voices/Angelina/PC_Female_Carefree_GVR_ENG.bnk",
        "WOTR Voices/Chen/PC_Male_Brave_GVR_ENG.bnk",
      ],
      "/staging/x",
    );
    expect(copies(result).map((c) => c.destination)).toEqual([
      "PC_Female_Carefree_GVR_ENG.bnk",
      "PC_Male_Brave_GVR_ENG.bnk",
    ]);
  });

  it("defers a multi-variant pack to the Mods folder with no voice mod type", async () => {
    const result = await installVoice(
      ["variant a/PC_Male_Madman_GVR_ENG.bnk", "variant b/PC_Male_Madman_GVR_ENG.bnk"],
      "/staging/x",
    );
    expect(modType(result)).toBeUndefined();
    expect(copies(result).map((c) => c.destination)).toEqual([
      "variant a/PC_Male_Madman_GVR_ENG.bnk",
      "variant b/PC_Male_Madman_GVR_ENG.bnk",
    ]);
  });
});
