/**
 * Writes a minimal but well-formed Bethesda plugin (esp) so the gamebryo plugin management
 * extension parses each fixture member cleanly instead of logging a parse failure per mod.
 *
 * The header layout is what `extensions/gamebryo-plugin-management/src/esp/ESPFile.ts` reads:
 * a 20-byte TES4 record header, 4 bytes of version info, then subrecords of tag[4] + size[2] +
 * payload. HEDR carries the record count (kept non-zero so the plugin is not treated as empty),
 * CNAM the author, SNAM the description, and each MAST names a master file.
 */

export interface IPluginSpec {
  author: string;
  description: string;
  masters: string[];
  /** set the light (esl) flag */
  light?: boolean;
}

const FLAG_LIGHT = 0x00000200;

function subrecord(tag: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(6);
  head.write(tag, 0, 4, "ascii");
  head.writeUInt16LE(payload.length, 4);
  return Buffer.concat([head, payload]);
}

function zstring(value: string): Buffer {
  return Buffer.concat([Buffer.from(value, "ascii"), Buffer.alloc(1)]);
}

export function makePlugin(spec: IPluginSpec): Buffer {
  const hedr = Buffer.alloc(12);
  hedr.writeFloatLE(1.7, 0);
  hedr.writeInt32LE(1, 4); // numRecords
  hedr.writeUInt32LE(0x800, 8); // nextObjectId

  const subrecords: Buffer[] = [
    subrecord("HEDR", hedr),
    subrecord("CNAM", zstring(spec.author)),
    subrecord("SNAM", zstring(spec.description)),
  ];
  for (const master of spec.masters) {
    subrecords.push(subrecord("MAST", zstring(master)));
    subrecords.push(subrecord("DATA", Buffer.alloc(8)));
  }
  const data = Buffer.concat(subrecords);

  const header = Buffer.alloc(24);
  header.write("TES4", 0, 4, "ascii");
  header.writeUInt32LE(data.length, 4);
  header.writeUInt32LE(spec.light ? FLAG_LIGHT : 0, 8);
  header.writeUInt32LE(0, 12); // form id
  header.writeUInt32LE(0, 16); // revision
  header.writeUInt16LE(44, 20); // form version
  header.writeUInt16LE(0, 22);
  return Buffer.concat([header, data]);
}
