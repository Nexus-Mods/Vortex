import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import IniParser, { WinapiFormat } from "vortex-parse-ini";

type Sections = Record<string, Record<string, string>>;

const parser = () => new IniParser(new WinapiFormat());

// mods.settings is written by the game through the Windows profile API, so the
// extension reads it with WinapiFormat on every platform. On Windows that calls
// the native API; elsewhere patches/vortex-parse-ini@0.4.0.patch reproduces it
// in JS, which is what these tests cover.
describe.skipIf(process.platform === "win32")("WinapiFormat without the Windows API", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "winapi-format-"));
    filePath = path.join(dir, "mods.settings");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads sections and keys, skipping comments and lines without a value", async () => {
    await writeFile(
      filePath,
      "; written by the game\r\n[modA]\r\nEnabled=1\r\nPriority = 2\r\nnoise\r\n\r\n[modB]\r\nEnabled=0\r\n",
    );

    const ini = await parser().read<Sections>(filePath);

    expect(ini.data).toEqual({
      modA: { Enabled: "1", Priority: "2" },
      modB: { Enabled: "0" },
    });
  });

  it("rewrites only the changed keys and keeps the rest of the file", async () => {
    await writeFile(
      filePath,
      "; keep me\r\n[modA]\r\nEnabled=1\r\nPriority = 2\r\n\r\n[modB]\r\nEnabled=0\r\nPriority=3\r\n",
    );

    const ini = await parser().read<Sections>(filePath);
    ini.data.modA.Enabled = "0";
    delete ini.data.modB.Priority;
    ini.data.modC = { Enabled: "1", Priority: "4" };
    await parser().write(filePath, ini);

    expect(await readFile(filePath, "utf8")).toBe(
      "; keep me\r\n[modA]\r\nEnabled=0\r\nPriority = 2\r\n\r\n[modB]\r\nEnabled=0\r\n\r\n[modC]\r\nEnabled=1\r\nPriority=4\r\n",
    );
  });

  it("matches sections and keys case-insensitively and reads only the first duplicate section", async () => {
    await writeFile(filePath, "[ModA]\nenabled=1\n[moda]\nEnabled=0\nExtra=1\n");

    const ini = await parser().read<Sections>(filePath);
    expect(ini.data).toEqual({ ModA: { enabled: "1" } });

    ini.data.ModA.enabled = "0";
    await parser().write(filePath, ini);

    expect(await readFile(filePath, "utf8")).toBe(
      "[ModA]\nenabled=0\n[moda]\nEnabled=0\nExtra=1\n",
    );
  });

  it("keeps the bytes of files that aren't UTF-8", async () => {
    await writeFile(filePath, Buffer.from("[modA]\r\nName=Caf\xe9\r\nEnabled=1\r\n", "latin1"));

    const ini = await parser().read<Sections>(filePath);
    expect(ini.data.modA.Name).toBe("Caf\xe9");

    ini.data.modA.Enabled = "0";
    await parser().write(filePath, ini);

    expect(await readFile(filePath)).toEqual(
      Buffer.from("[modA]\r\nName=Caf\xe9\r\nEnabled=0\r\n", "latin1"),
    );
  });

  it("treats a missing file as empty and creates it on write", async () => {
    const ini = await parser().read<Sections>(filePath);
    expect(ini.data).toEqual({});

    ini.data.modA = { Enabled: "1" };
    await parser().write(filePath, ini);

    expect(await readFile(filePath, "utf8")).toBe("[modA]\r\nEnabled=1\r\n");
  });
});
