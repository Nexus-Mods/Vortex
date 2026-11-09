import * as nodeFs from "node:fs";
import * as path from "node:path";

import { expect } from "vitest";

import { test } from "../../test-utils/deploymentTest";

type IsLink = (
  linkPath: string,
  sourcePath: string,
  linkStats?: Partial<nodeFs.Stats>,
  sourceStats?: Partial<nodeFs.Stats>,
) => Promise<boolean>;

// ReFS file ids exceed 2^53: neighbouring ids collapse to the same number
const REFS_INO = 6917529027680460000;

test("doesn't take files with the same imprecise ReFS id for a link", async ({
  makeDeployment,
}) => {
  const h = makeDeployment({ files: { "d3d9.dll": "enb" } });
  const source = path.join(h.modDir("SomeMod"), "d3d9.dll");
  const other = path.join(h.stagingDir, "Other", "d3d9.dll");
  nodeFs.mkdirSync(path.dirname(other), { recursive: true });
  nodeFs.writeFileSync(other, "dinput");
  nodeFs.mkdirSync(h.gameDir, { recursive: true });
  nodeFs.linkSync(other, h.inGame("d3d9.dll"));

  const isLink = (h.method as unknown as { isLink: IsLink }).isLink.bind(h.method);
  const stats = { nlink: 2, ino: REFS_INO, dev: 1 };
  await expect(isLink(h.inGame("d3d9.dll"), source, stats, stats)).resolves.toBe(false);
  await expect(isLink(h.inGame("d3d9.dll"), other, stats, stats)).resolves.toBe(true);
});

test("trusts exact ids it is given", async ({ makeDeployment }) => {
  const h = makeDeployment({ files: { "d3d9.dll": "enb" } });
  const isLink = (h.method as unknown as { isLink: IsLink }).isLink.bind(h.method);
  // neither path exists, so a result can only come from the stats
  const missing = path.join(h.gameDir, "missing.dll");
  await expect(
    isLink(missing, missing, { nlink: 2, ino: 42 }, { nlink: 1, ino: 42 }),
  ).resolves.toBe(true);
  await expect(
    isLink(missing, missing, { nlink: 2, ino: 42 }, { nlink: 1, ino: 43 }),
  ).resolves.toBe(false);
  await expect(isLink(missing, missing, { nlink: 1, ino: 42 }, { ino: 42 })).resolves.toBe(false);
});
