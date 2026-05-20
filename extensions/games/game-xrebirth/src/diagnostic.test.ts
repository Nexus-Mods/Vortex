import { describe, test, expect } from "vitest";

import { healthChecks } from "./diagnostic";
import { XREBIRTH_MOD_TYPES } from "./installers";

const [modHasFilesCheck, customFileNameCheck, modShapeCheck] = healthChecks;

function mod(opts: { files?: string[]; attributes?: Record<string, unknown> }): {
  id: string;
  state: "installed";
  type: string;
  installationPath: string;
  files: string[];
  attributes: Record<string, unknown>;
} {
  return {
    id: "test",
    state: "installed",
    type: "",
    installationPath: "test",
    files: opts.files ?? [],
    attributes: opts.attributes ?? {},
  };
}

const ctx = {
  modId: "test",
  files: [],
  readFile: async () => Buffer.alloc(0),
  attributes: {},
};

describe("modHasFilesCheck", () => {
  test("warns when installer produced no files", async () => {
    const result = await modHasFilesCheck!.checkMod(
      {},
      { ...ctx, files: mod({ files: [] }).files },
    );
    expect(result.status).toBe("warning");
    expect(result.message).toMatch(/no files/i);
  });

  test("passes when there is at least one file", async () => {
    const result = await modHasFilesCheck!.checkMod({}, { ...ctx, files: ["a/b.xml"] });
    expect(result.status).toBe("passed");
  });
});

describe("contentXmlCustomFileNameCheck", () => {
  test("not applicable when not a content.xml mod", async () => {
    const result = await customFileNameCheck!.checkMod(
      {},
      { ...ctx, files: ["readme.txt"], attributes: {} },
    );
    expect(result.status).toBe("passed");
    expect(result.message).toMatch(/not applicable/i);
  });

  test("warns when content.xml mod is missing customFileName", async () => {
    const result = await customFileNameCheck!.checkMod(
      {},
      { ...ctx, files: ["mod/content.xml"], attributes: {} },
    );
    expect(result.status).toBe("warning");
    expect(result.message).toMatch(/missing customFileName/i);
  });

  test("passes when content.xml mod has customFileName", async () => {
    const result = await customFileNameCheck!.checkMod(
      {},
      {
        ...ctx,
        files: ["mod/content.xml"],
        attributes: { customFileName: "Awesome Mod" },
      },
    );
    expect(result.status).toBe("passed");
  });

  test("detects content.xml at any depth, case-insensitive", async () => {
    const result = await customFileNameCheck!.checkMod(
      {},
      { ...ctx, files: ["deep/path/Content.XML"], attributes: {} },
    );
    expect(result.status).toBe("warning");
  });
});

describe("modShapeRecognisedCheck", () => {
  test("recognised as content.xml mod", async () => {
    const result = await modShapeCheck!.checkMod(
      {},
      { ...ctx, files: ["a/content.xml"], attributes: {} },
    );
    expect(result.status).toBe("passed");
    expect(result.message).toMatch(/content\.xml/);
  });

  test("recognised by tagged modType", async () => {
    const result = await modShapeCheck!.checkMod(
      {},
      {
        ...ctx,
        files: ["tool.exe"],
        attributes: { modType: XREBIRTH_MOD_TYPES.utility },
      },
    );
    expect(result.status).toBe("passed");
    expect(result.message).toContain(XREBIRTH_MOD_TYPES.utility);
  });

  test("recognised by stopPattern match", async () => {
    const result = await modShapeCheck!.checkMod(
      {},
      { ...ctx, files: ["data.cat"], attributes: {} },
    );
    expect(result.status).toBe("passed");
    expect(result.message).toMatch(/stopPatterns/);
  });

  test("warns when nothing recognised", async () => {
    const result = await modShapeCheck!.checkMod(
      {},
      { ...ctx, files: ["random.bin"], attributes: {} },
    );
    expect(result.status).toBe("warning");
  });
});
