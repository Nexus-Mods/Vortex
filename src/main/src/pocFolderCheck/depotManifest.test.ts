import { describe, expect, it } from "vitest";

import { readDepotManifest } from "./depotManifest";
import { end, field, MAGIC, section } from "./testManifest";

const EXE_SHA1 = "2f784a183f884067a9a41338664b55f6dc198a48";

const metadata = (encrypted: bigint) =>
  section(
    MAGIC.metadata,
    Buffer.concat([field(1, 489833n), field(2, 4886117324142477814n), field(4, encrypted)]),
  );

describe("readDepotManifest", () => {
  it("reads files, sizes, flags and sha1", () => {
    const mapping = Buffer.concat([
      field(1, "SkyrimSE.exe"),
      field(2, 37910440n),
      field(3, 0n),
      field(5, Buffer.from(EXE_SHA1, "hex")),
      field(6, Buffer.concat([field(1, 1n), field(2, 2n)])),
    ]);
    const result = readDepotManifest(
      Buffer.concat([section(MAGIC.payload, field(1, mapping)), metadata(0n), end()]),
    );
    expect(result.files).toEqual([
      { name: "SkyrimSE.exe", size: 37910440, flags: 0, sha1: EXE_SHA1, linkTarget: "" },
    ]);
  });

  it("reads metadata", () => {
    const plain = readDepotManifest(Buffer.concat([metadata(0n), end()]));
    expect(plain.depotId).toBe(489833);
    expect(plain.manifestId).toBe("4886117324142477814");
    expect(plain.filenamesEncrypted).toBe(false);

    const encrypted = readDepotManifest(Buffer.concat([metadata(1n), end()]));
    expect(encrypted.filenamesEncrypted).toBe(true);
  });

  it("skips the signature section", () => {
    const mapping = Buffer.concat([field(1, "a.txt"), field(2, 1n)]);
    const result = readDepotManifest(
      Buffer.concat([
        section(MAGIC.payload, field(1, mapping)),
        section(MAGIC.signature, Buffer.from([1, 2, 3, 4, 5])),
        metadata(0n),
        end(),
      ]),
    );
    expect(result.files).toHaveLength(1);
    expect(result.depotId).toBe(489833);
  });

  it("keeps Windows separators and link targets", () => {
    const mapping = Buffer.concat([
      field(1, "Data\\Skyrim.esm"),
      field(2, 10n),
      field(7, "target.bin"),
    ]);
    const result = readDepotManifest(
      Buffer.concat([section(MAGIC.payload, field(1, mapping)), metadata(0n), end()]),
    );
    expect(result.files[0]?.name).toBe("Data\\Skyrim.esm");
    expect(result.files[0]?.linkTarget).toBe("target.bin");
    expect(result.files[0]?.sha1).toBe("");
  });

  it("throws on an unknown magic", () => {
    expect(() => readDepotManifest(section(0x12345678, Buffer.alloc(4)))).toThrow(
      /invalid depot manifest/,
    );
  });

  it("throws on a truncated section", () => {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(MAGIC.payload, 0);
    header.writeUInt32LE(100, 4);
    expect(() => readDepotManifest(Buffer.concat([header, Buffer.alloc(4)]))).toThrow(
      /invalid depot manifest/,
    );
  });
});
