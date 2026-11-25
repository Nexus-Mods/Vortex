import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

const extensionPath = path.resolve(import.meta.dirname);
const packagePath = path.join(extensionPath, "dist", "nexus-package");
const metadata = JSON.parse(await readFile(path.join(extensionPath, "package.json"), "utf8"));

await mkdir(packagePath, { recursive: true });
await copyFile(path.join(extensionPath, "dist", "index.cjs"), path.join(packagePath, "index.js"));
await copyFile(
  path.join(extensionPath, "assets", "gameart.png"),
  path.join(packagePath, "gameart.png"),
);
await writeFile(
  path.join(packagePath, "info.json"),
  `${JSON.stringify(
    {
      name: "Lost Eidolons",
      author: metadata.author,
      version: metadata.version,
      description: "Vortex Extension for Lost Eidolons",
      gameId: 4919,
    },
    null,
    2,
  )}\n`,
);
