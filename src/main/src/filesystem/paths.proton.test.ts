import { PathResolverError, QualifiedPath } from "@nexusmods/adaptor-api/fs";
import { describe, expect, it } from "vitest";

import {
  decodeProtonCompatDataPath,
  encodeProtonCompatDataPath,
  ProtonWindowsPathResolverImpl,
} from "./paths.proton";

describe("ProtonWindowsPathResolverImpl", () => {
  const compatDataPath = "/home/alice/.steam/steam/steamapps/compatdata/1091500";
  const protonData = encodeProtonCompatDataPath(compatDataPath);
  const resolver = new ProtonWindowsPathResolverImpl();

  it("round-trips the encoded compatdata path", () => {
    expect(decodeProtonCompatDataPath(protonData)).toBe(compatDataPath);
  });

  it("maps C: into the Proton Wine prefix", async () => {
    const qp = QualifiedPath.parse(`windows://${protonData}///C/users/steamuser/AppData`);
    await expect(resolver.resolve(qp)).resolves.toBe(
      "/home/alice/.steam/steam/steamapps/compatdata/1091500/pfx/drive_c/users/steamuser/AppData",
    );
  });

  it("maps Z: back to the Linux host root", async () => {
    const qp = QualifiedPath.parse(`windows://${protonData}///Z/home/alice/Games/Cyberpunk 2077`);
    await expect(resolver.resolve(qp)).resolves.toBe("/home/alice/Games/Cyberpunk 2077");
  });

  it("rejects untagged Windows paths on Linux", async () => {
    const qp = QualifiedPath.parse("windows:///C/users/steamuser");
    await expect(resolver.resolve(qp)).rejects.toBeInstanceOf(PathResolverError);
  });

  it("rejects non-C/Z drives until a host mapping is known", async () => {
    const qp = QualifiedPath.parse(`windows://${protonData}///D/Games/Foo`);
    await expect(resolver.resolve(qp)).rejects.toBeInstanceOf(PathResolverError);
  });
});
