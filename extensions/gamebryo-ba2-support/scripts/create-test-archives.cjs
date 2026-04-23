/**
 * Creates synthetic BA2 test archives with known content.
 * These are valid BA2 v1 files that can be parsed by both the native
 * ba2tk module and our TypeScript implementation.
 *
 * Run: node extensions/gamebryo-ba2-support/scripts/create-test-archives.cjs
 */

const { writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");
const zlib = require("zlib");

const OUT_DIR = join(__dirname, "..", "test-data");
mkdirSync(OUT_DIR, { recursive: true });

// --- Helpers ---

function writeUint32LE(buf, offset, val) {
    buf.writeUInt32LE(val, offset);
}

function writeUint64LE(buf, offset, val) {
    // For values that fit in 32 bits
    buf.writeUInt32LE(val & 0xffffffff, offset);
    buf.writeUInt32LE(Math.floor(val / 0x100000000), offset + 4);
}

function writeString(buf, offset, str) {
    for (let i = 0; i < str.length; i++) {
        buf[offset + i] = str.charCodeAt(i);
    }
}

// --- Create GNRL archive ---

function createGnrlArchive() {
    const files = [
        {
            name: "meshes\\weapon\\gun.nif",
            content: Buffer.from("fake nif data for gun model"),
        },
        {
            name: "scripts\\myscript.pex",
            content: Buffer.from("fake compiled papyrus script"),
        },
        {
            name: "materials\\test.bgsm",
            content: Buffer.from("fake material data"),
        },
    ];

    // Compress each file's content
    const entries = files.map((f) => {
        const compressed = zlib.deflateSync(f.content);
        return {
            name: f.name,
            content: f.content,
            compressed,
            useCompression: compressed.length < f.content.length,
        };
    });

    const HEADER_SIZE = 24; // 0x18
    const ENTRY_SIZE = 36;
    const entriesStart = HEADER_SIZE;
    const entriesEnd = entriesStart + entries.length * ENTRY_SIZE;

    // Calculate data offsets
    let dataOffset = entriesEnd;
    const entryOffsets = [];
    for (const entry of entries) {
        entryOffsets.push(dataOffset);
        dataOffset += entry.useCompression
            ? entry.compressed.length
            : entry.content.length;
    }

    const nameTableOffset = dataOffset;

    // Build name table
    const nameParts = [];
    for (const entry of entries) {
        const nameBuf = Buffer.alloc(2 + entry.name.length);
        nameBuf.writeUInt16LE(entry.name.length, 0);
        nameBuf.write(entry.name, 2, "ascii");
        nameParts.push(nameBuf);
    }
    const nameTable = Buffer.concat(nameParts);

    const totalSize = nameTableOffset + nameTable.length;
    const buf = Buffer.alloc(totalSize);

    // Header
    writeString(buf, 0x00, "BTDX");
    writeUint32LE(buf, 0x04, 1); // version
    writeString(buf, 0x08, "GNRL");
    writeUint32LE(buf, 0x0c, entries.length);
    writeUint64LE(buf, 0x10, nameTableOffset);

    // File entries
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const off = entriesStart + i * ENTRY_SIZE;
        writeUint32LE(buf, off + 0x00, 0x12345678); // nameHash
        // Extension: take last 3 chars + null
        const ext = e.name.split(".").pop() || "";
        writeString(buf, off + 0x04, ext.slice(0, 4).padEnd(4, "\0"));
        writeUint32LE(buf, off + 0x08, 0xaabbccdd); // dirHash
        writeUint32LE(buf, off + 0x0c, 0x00100100); // flags
        writeUint64LE(buf, off + 0x10, entryOffsets[i]); // offset
        writeUint32LE(
            buf,
            off + 0x18,
            e.useCompression ? e.compressed.length : 0,
        ); // packedLen
        writeUint32LE(buf, off + 0x1c, e.content.length); // unpackedLen
        writeUint32LE(buf, off + 0x20, 0xbaadf00d); // sentinel
    }

    // File data
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const data = e.useCompression ? e.compressed : e.content;
        data.copy(buf, entryOffsets[i]);
    }

    // Name table
    nameTable.copy(buf, nameTableOffset);

    return { buf, files: entries.map((e) => e.name) };
}

// --- Create DX10 archive ---

function createDx10Archive() {
    const textures = [
        {
            name: "textures\\weapons\\gun_d.dds",
            width: 256,
            height: 256,
            numMips: 9,
            dxgiFormat: 71, // BC2_UNORM
            chunks: [
                Buffer.from(
                    "fake mip0 texture data chunk that is reasonably long for compression",
                ),
                Buffer.from("fake mip1 data"),
            ],
        },
        {
            name: "textures\\weapons\\gun_n.dds",
            width: 128,
            height: 128,
            numMips: 8,
            dxgiFormat: 77, // BC5_UNORM
            chunks: [
                Buffer.from(
                    "fake normal map chunk data for testing the dx10 parser",
                ),
            ],
        },
    ];

    const HEADER_SIZE = 24;

    // Calculate texture entry sizes
    // Each texture: 24 bytes header + numChunks * 24 bytes
    let entriesSize = 0;
    for (const tex of textures) {
        entriesSize += 24 + tex.chunks.length * 24;
    }

    const entriesStart = HEADER_SIZE;
    const entriesEnd = entriesStart + entriesSize;

    // Compress chunks and calculate data offsets
    let dataOffset = entriesEnd;
    const texEntries = textures.map((tex) => {
        const compressedChunks = tex.chunks.map((chunk) => {
            const compressed = zlib.deflateSync(chunk);
            const offset = dataOffset;
            const useCompression = compressed.length < chunk.length;
            dataOffset += useCompression ? compressed.length : chunk.length;
            return {
                original: chunk,
                compressed,
                useCompression,
                offset,
            };
        });
        return { ...tex, compressedChunks };
    });

    const nameTableOffset = dataOffset;

    // Build name table
    const nameParts = [];
    for (const tex of texEntries) {
        const nameBuf = Buffer.alloc(2 + tex.name.length);
        nameBuf.writeUInt16LE(tex.name.length, 0);
        nameBuf.write(tex.name, 2, "ascii");
        nameParts.push(nameBuf);
    }
    const nameTable = Buffer.concat(nameParts);

    const totalSize = nameTableOffset + nameTable.length;
    const buf = Buffer.alloc(totalSize);

    // Header
    writeString(buf, 0x00, "BTDX");
    writeUint32LE(buf, 0x04, 1); // version
    writeString(buf, 0x08, "DX10");
    writeUint32LE(buf, 0x0c, texEntries.length);
    writeUint64LE(buf, 0x10, nameTableOffset);

    // Texture entries
    let entryOffset = entriesStart;
    for (const tex of texEntries) {
        // Texture header (24 bytes)
        writeUint32LE(buf, entryOffset + 0x00, 0x12345678); // nameHash
        writeString(buf, entryOffset + 0x04, "dds\0"); // ext
        writeUint32LE(buf, entryOffset + 0x08, 0xaabbccdd); // dirHash
        buf[entryOffset + 0x0c] = 0; // unk0C
        buf[entryOffset + 0x0d] = tex.compressedChunks.length; // numChunks
        buf.writeUInt16LE(24, entryOffset + 0x0e); // chunkHdrLen
        buf.writeUInt16LE(tex.height, entryOffset + 0x10);
        buf.writeUInt16LE(tex.width, entryOffset + 0x12);
        buf[entryOffset + 0x14] = tex.numMips;
        buf[entryOffset + 0x15] = tex.dxgiFormat;
        buf.writeUInt16LE(0x0800, entryOffset + 0x16); // unk16
        entryOffset += 24;

        // Chunk headers (24 bytes each)
        let mipCounter = 0;
        for (const chunk of tex.compressedChunks) {
            writeUint64LE(buf, entryOffset + 0x00, chunk.offset);
            writeUint32LE(
                buf,
                entryOffset + 0x08,
                chunk.useCompression ? chunk.compressed.length : 0,
            );
            writeUint32LE(buf, entryOffset + 0x0c, chunk.original.length);
            buf.writeUInt16LE(mipCounter, entryOffset + 0x10); // startMip
            buf.writeUInt16LE(mipCounter, entryOffset + 0x12); // endMip
            writeUint32LE(buf, entryOffset + 0x14, 0xbaadf00d); // sentinel
            entryOffset += 24;
            mipCounter++;
        }
    }

    // File data
    for (const tex of texEntries) {
        for (const chunk of tex.compressedChunks) {
            const data = chunk.useCompression
                ? chunk.compressed
                : chunk.original;
            data.copy(buf, chunk.offset);
        }
    }

    // Name table
    nameTable.copy(buf, nameTableOffset);

    return { buf, files: texEntries.map((t) => t.name) };
}

// --- Create stripped versions (header + entries + name table, no file data) ---

function stripArchive(fullBuf) {
    // Read header
    const fileCount = fullBuf.readUInt32LE(0x0c);
    const nameTableOffset = Number(fullBuf.readBigUInt64LE(0x10));
    const type = fullBuf.toString("ascii", 0x08, 0x0c);

    // Calculate entries end
    let entriesEnd;
    if (type === "GNRL") {
        entriesEnd = 24 + fileCount * 36;
    } else {
        // DX10: variable size, need to walk entries
        let off = 24;
        for (let i = 0; i < fileCount; i++) {
            const numChunks = fullBuf[off + 0x0d];
            off += 24 + numChunks * 24;
        }
        entriesEnd = off;
    }

    // Copy header + entries
    const headerAndEntries = Buffer.from(fullBuf.subarray(0, entriesEnd));

    // Copy name table
    const nameTable = Buffer.from(fullBuf.subarray(nameTableOffset));

    // In the stripped file, name table follows immediately after entries
    const newNameTableOffset = entriesEnd;
    const stripped = Buffer.concat([headerAndEntries, nameTable]);

    // Update the name table offset in the header
    stripped.writeBigUInt64LE(BigInt(newNameTableOffset), 0x10);

    // Zero out file data offsets in entries (they'd point to invalid locations)
    // We keep them as-is for now; tests just won't try to extract

    return stripped;
}

// --- Main ---

const gnrl = createGnrlArchive();
const dx10 = createDx10Archive();

// Write full archives (for benchmarking, gitignored)
writeFileSync(join(OUT_DIR, "test-gnrl-full.ba2"), gnrl.buf);
writeFileSync(join(OUT_DIR, "test-dx10-full.ba2"), dx10.buf);

// Write stripped archives (for committed tests)
writeFileSync(join(OUT_DIR, "test-gnrl.ba2"), stripArchive(gnrl.buf));
writeFileSync(join(OUT_DIR, "test-dx10.ba2"), stripArchive(dx10.buf));

// Write verification JSON
const verification = {
    gnrl: {
        type: "general",
        version: 1,
        fileCount: gnrl.files.length,
        fileList: gnrl.files,
    },
    dx10: {
        type: "dx10",
        version: 1,
        fileCount: dx10.files.length,
        fileList: dx10.files,
    },
};
writeFileSync(
    join(OUT_DIR, "expected.json"),
    JSON.stringify(verification, null, 2) + "\n",
);

console.log("Created test archives:");
console.log("  test-gnrl-full.ba2:", gnrl.buf.length, "bytes");
console.log("  test-dx10-full.ba2:", dx10.buf.length, "bytes");
console.log(
    "  test-gnrl.ba2:",
    stripArchive(gnrl.buf).length,
    "bytes (stripped)",
);
console.log(
    "  test-dx10.ba2:",
    stripArchive(dx10.buf).length,
    "bytes (stripped)",
);
console.log("  expected.json");
console.log("\nGNRL files:", gnrl.files);
console.log("DX10 files:", dx10.files);
