import path from "node:path";

import { setReadFileResolver } from "@vortex/extension-test-mocks";
import { describe, test, it, expect, beforeEach } from "vitest";

import {
  installContentXml,
  modHasFilesCheck,
  contentXmlCustomFileNameCheck,
  modShapeRecognisedCheck,
} from "./hooks";

// ---------------------------------------------------------------------------
// installContentXml
// ---------------------------------------------------------------------------

describe("installContentXml", () => {
  beforeEach(() => {
    setReadFileResolver(async () => Buffer.alloc(0));
  });

  it("emits attribute + copy instructions for a well-formed content.xml", async () => {
    setReadFileResolver(
      async () =>
        '<?xml version="1.0"?>' +
        '<content id="my-mod" name="  My Mod " description="A test" ' +
        'save="true" author="me" version="1.0" />',
    );

    const result = await installContentXml(
      ["wrap/content.xml", "wrap/data.cat", "wrap/dir/"],
      "/install/dest",
    );

    expect(result.instructions).toContainEqual({
      type: "attribute",
      key: "customFileName",
      value: "My Mod",
    });
    expect(result.instructions).toContainEqual({ type: "attribute", key: "sticky", value: true });
    expect(result.instructions).toContainEqual({ type: "attribute", key: "author", value: "me" });

    const copyInstructions = result.instructions.filter((i) => i.type === "copy");
    expect(copyInstructions).toEqual([
      { type: "copy", source: "wrap/content.xml", destination: path.join("my-mod", "content.xml") },
      { type: "copy", source: "wrap/data.cat", destination: path.join("my-mod", "data.cat") },
    ]);
  });

  it("throws DataInvalid for malformed XML", async () => {
    setReadFileResolver(async () => "<<<not xml>>>");
    await expect(installContentXml(["content.xml"], "/dest")).rejects.toMatchObject({
      name: "DataInvalid",
    });
  });

  it("throws DataInvalid when content.xml has no id attribute", async () => {
    setReadFileResolver(async () => '<?xml version="1.0"?><content name="anon" />');
    await expect(installContentXml(["content.xml"], "/dest")).rejects.toMatchObject({
      name: "DataInvalid",
    });
  });
});

// ---------------------------------------------------------------------------
// health checks
// ---------------------------------------------------------------------------

const ctx = {
  modId: "test",
  files: [] as string[],
  readFile: async () => Buffer.alloc(0),
  attributes: {} as Record<string, unknown>,
};

// The health checks ignore the api argument; derive its type from checkMod so
// the unused stub stays correctly typed.
const STUB_API = {} as unknown as Parameters<typeof modHasFilesCheck.checkMod>[0];

describe("modHasFilesCheck", () => {
  test("warns when installer produced no files", async () => {
    const result = await modHasFilesCheck.checkMod(STUB_API, { ...ctx, files: [] });
    expect(result.status).toBe("warning");
    expect(result.message).toMatch(/no files/i);
  });

  test("passes when there is at least one file", async () => {
    const result = await modHasFilesCheck.checkMod(STUB_API, { ...ctx, files: ["a/b.xml"] });
    expect(result.status).toBe("passed");
  });
});

describe("contentXmlCustomFileNameCheck", () => {
  test("not applicable when not a content.xml mod", async () => {
    const result = await contentXmlCustomFileNameCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["readme.txt"],
      attributes: {},
    });
    expect(result.status).toBe("passed");
    expect(result.message).toMatch(/not applicable/i);
  });

  test("warns when content.xml mod is missing customFileName", async () => {
    const result = await contentXmlCustomFileNameCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["mod/content.xml"],
      attributes: {},
    });
    expect(result.status).toBe("warning");
    expect(result.message).toMatch(/missing customFileName/i);
  });

  test("passes when content.xml mod has customFileName", async () => {
    const result = await contentXmlCustomFileNameCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["mod/content.xml"],
      attributes: { customFileName: "Awesome Mod" },
    });
    expect(result.status).toBe("passed");
  });

  test("detects content.xml at any depth, case-insensitive", async () => {
    const result = await contentXmlCustomFileNameCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["deep/path/Content.XML"],
      attributes: {},
    });
    expect(result.status).toBe("warning");
  });
});

describe("modShapeRecognisedCheck", () => {
  test("recognised as content.xml mod", async () => {
    const result = await modShapeRecognisedCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["a/content.xml"],
      attributes: {},
    });
    expect(result.status).toBe("passed");
    expect(result.message).toMatch(/content\.xml/);
  });

  test("recognised by tagged modType", async () => {
    const result = await modShapeRecognisedCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["tool.exe"],
      attributes: { modType: "xrebirth-utility" },
    });
    expect(result.status).toBe("passed");
    expect(result.message).toContain("xrebirth-utility");
  });

  test("recognised by stopPattern match", async () => {
    const result = await modShapeRecognisedCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["data.cat"],
      attributes: {},
    });
    expect(result.status).toBe("passed");
    expect(result.message).toMatch(/stopPatterns/);
  });

  test("warns when nothing recognised", async () => {
    const result = await modShapeRecognisedCheck.checkMod(STUB_API, {
      ...ctx,
      files: ["random.bin"],
      attributes: {},
    });
    expect(result.status).toBe("warning");
  });
});
