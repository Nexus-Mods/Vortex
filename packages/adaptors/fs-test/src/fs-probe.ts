import { provides } from "@nexusmods/adaptor-api";
import { QualifiedPath } from "@nexusmods/adaptor-api/fs";
import { fs } from "virtual:services";

/**
 * Adaptor-facing test service that exercises the host `FileSystem`
 * service from inside the sandboxed Worker. Each method takes serialised
 * `QualifiedPath`s (plain `{ value, scheme, path }` objects crossing the
 * RPC boundary), rebuilds `QualifiedPath` instances, and drives the
 * injected `fs` client.
 *
 * The integration test uses this service as a probe to confirm that
 * every piece of the wiring — bootstrap container setup, client
 * polyfill, transport, host handler, error envelope — connects
 * correctly end-to-end.
 */
export interface IFsProbe {
  writeRead(path: QualifiedPath, contents: number[]): Promise<number[]>;
  readMissing(path: QualifiedPath): Promise<{
    name: string;
    code: string;
    isTransient: boolean;
  }>;
  listFiles(path: QualifiedPath): Promise<string[]>;
}

@provides("vortex:adaptor/fs-test/probe")
export class FsProbeService implements IFsProbe {
  async writeRead(
    rawPath: QualifiedPath,
    contents: number[],
  ): Promise<number[]> {
    const path = rehydrate(rawPath);
    await fs.writeFile(path, new Uint8Array(contents));
    const bytes = await fs.readFile(path);
    return Array.from(bytes);
  }

  async readMissing(rawPath: QualifiedPath): Promise<{
    name: string;
    code: string;
    isTransient: boolean;
  }> {
    const path = rehydrate(rawPath);
    try {
      await fs.readFile(path);
      throw new Error("expected readFile to reject");
    } catch (err: unknown) {
      // Cannot use `err instanceof Error` here: the adaptor runs inside a
      // VM sandbox whose `Error` global is a different constructor from
      // the one `@nexusmods/adaptor-api/fs` uses on the host side. Duck-type instead.
      if (err !== null && typeof err === "object") {
        const e = err as {
          name?: unknown;
          code?: unknown;
          isTransient?: unknown;
        };
        return {
          name: typeof e.name === "string" ? e.name : "",
          code: typeof e.code === "string" ? e.code : "",
          isTransient: Boolean(e.isTransient),
        };
      }
      throw err;
    }
  }

  async listFiles(rawPath: QualifiedPath): Promise<string[]> {
    const path = rehydrate(rawPath);
    const iterator = await fs.enumerateDirectory(path, { types: "files" });
    const names: string[] = [];
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      const value = next.value;
      if (value instanceof QualifiedPath) {
        names.push(value.basename);
      }
    }
    return names.sort();
  }
}

function rehydrate(raw: QualifiedPath): QualifiedPath {
  if (raw instanceof QualifiedPath) return raw;
  const asObj = raw as unknown as { value: string };
  return QualifiedPath.parse(asObj.value);
}
