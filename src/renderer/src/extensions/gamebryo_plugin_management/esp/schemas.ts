import bin from "typed-binary";

/** TES4 record header (20 bytes) */
export const RecordHeader = bin.object({
  type: bin.chars(4),
  dataSize: bin.u32,
  flags: bin.u32,
  id: bin.u32,
  revision: bin.u32,
});

/** Subrecord header (6 bytes) */
export const SubRecordHeader = bin.object({
  type: bin.chars(4),
  size: bin.u16,
});

/** HEDR subrecord payload (12 bytes) */
export const HEDRData = bin.object({
  version: bin.f32,
  numRecords: bin.i32,
  nextObjectId: bin.u32,
});
