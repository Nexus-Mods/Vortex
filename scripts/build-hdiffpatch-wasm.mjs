// Builds src/main/src/bsdiff/hdiffpatch/hdiffz.wasm, HDiffPatch's hdiffz with bzip2 as its only
// compressor, for wasm32-wasip1, and copies the HDiffPatch and bzip2 licences next to it.
// wasi-sdk and the sources are downloaded into the OS temp folder, pinned by version and sha256.
//
// usage: node scripts/build-hdiffpatch-wasm.mjs

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "src", "main", "src", "bsdiff", "hdiffpatch");
const workDir = path.join(os.tmpdir(), "vortex-hdiffpatch-wasm");

const WASI_SDK_VERSION = "34.0";
// sha256 of each wasi-sdk release archive, keyed by "<arch>-<os>" as the archive names them
const WASI_SDK_DIGESTS = {
  "arm64-linux": "f7e243dff54d60bcc576e94d6166b69f410f2500ae4a9ceef34315be10e77971",
  "arm64-macos": "9c59398106b417f8f14913380fdf0097a8cc0ff4af9eb3ce0065a859e88d49e9",
  "arm64-windows": "45e1c71f3e965621e7b98ebe1d37b0e4b1f77f3e8072113ffb4534e67b1a4b7c",
  "x86_64-linux": "b761e3a0721dbae9c09a0059e5fdb2bf917d1b4a8a7b430fb3b5aafb0984b2c4",
  "x86_64-macos": "87d27fa8adc68dee59bfbf2e22a6d34ef717c34d6bf1d8af2a56fc929d9ce0eb",
  "x86_64-windows": "cccb5c323a9b34f0349a9b09e8804a0a7632c68c3310f4b5f437ed57d7e71d8f",
};

// HDiffPatch v5.1.3, and the bzip2 its Makefile builds against
const SOURCES = {
  hdiffpatch: {
    repo: "sisong/HDiffPatch",
    commit: "3b9dca715ca492873bf2c49e22e5d5b7d2a78620",
    sha256: "62378965f548feaf5d5c3e1e2e65e985fae33ff4c87432cb42e60250d7e0d670",
  },
  bzip2: {
    repo: "sisong/bzip2",
    commit: "fbc4b11da543753b3b803e5546f56e26ec90c2a7",
    sha256: "aace791c1ca4ed458955e26a2bed649a6d850b966984560e9b9b08055cb88230",
  },
};

// hdiffz's Makefile object list with BSD=1 BZIP2=1 and every other compressor, checksum,
// directory diff and thread option off
const BZIP2_SOURCES = [
  "blocksort.c",
  "bzlib.c",
  "compress.c",
  "crctable.c",
  "decompress.c",
  "huffman.c",
  "randtable.c",
];
const HDIFFPATCH_C_SOURCES = [
  "libHDiffPatch/HPatch/patch.c",
  "libHDiffPatch/HDiff/private_diff/limit_mem_diff/adler_roll.c",
  "file_for_patch.c",
  "bsdiff_wrapper/bspatch_wrapper.c",
  "hdiffz_import_patch.c",
  "libHDiffPatch/HPatchLite/hpatch_lite.c",
];
const HDIFFPATCH_CXX_SOURCES = [
  "hdiffz.cpp",
  "libHDiffPatch/HDiff/diff.cpp",
  "libHDiffPatch/HDiff/private_diff/match_block.cpp",
  "libHDiffPatch/HDiff/private_diff/bytes_rle.cpp",
  "libHDiffPatch/HDiff/private_diff/suffix_string.cpp",
  "libHDiffPatch/HDiff/private_diff/compress_detect.cpp",
  "libHDiffPatch/HDiff/private_diff/limit_mem_diff/digest_matcher.cpp",
  "libHDiffPatch/HDiff/private_diff/limit_mem_diff/stream_serialize.cpp",
  "libHDiffPatch/HDiff/private_diff/libdivsufsort/divsufsort64.cpp",
  "libHDiffPatch/HDiff/private_diff/libdivsufsort/divsufsort.cpp",
  "libHDiffPatch/HDiff/private_diff/window_diff/window_matcher.cpp",
  "libHDiffPatch/HDiff/private_diff/window_diff/covers_range.cpp",
  "dirDiffPatch/dir_diff/dir_diff_tools.cpp",
  "bsdiff_wrapper/bsdiff_wrapper.cpp",
];

// HDiffPatch throws C++ exceptions; wasi-sdk's exception-enabled libc++ uses the standard
// (exnref) instructions, which every object must match
const EXCEPTION_FLAGS = ["-fwasm-exceptions", "-mllvm", "-wasm-use-legacy-eh=false"];

function hostPlatform() {
  const archName = { x64: "x86_64", arm64: "arm64" }[process.arch];
  const osName = { win32: "windows", linux: "linux", darwin: "macos" }[process.platform];
  const platform = `${archName}-${osName}`;
  if (WASI_SDK_DIGESTS[platform] === undefined) {
    throw new Error(
      `no wasi-sdk ${WASI_SDK_VERSION} build for ${process.platform} ${process.arch}`,
    );
  }
  return platform;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}${result.stdout}`);
  }
}

// downloads a .tar.gz into workDir, checks its sha256 and unpacks it; returns the folder it made
async function fetchArchive(url, sha256, fileName, unpackedName) {
  const unpackedDir = path.join(workDir, unpackedName);
  if (existsSync(unpackedDir)) {
    return unpackedDir;
  }
  console.log(`downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`downloading ${url} failed: ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(data).digest("hex");
  if (digest !== sha256) {
    throw new Error(`${url} has sha256 ${digest}, expected ${sha256}`);
  }
  await fs.writeFile(path.join(workDir, fileName), data);
  // a relative archive name, so GNU tar doesn't read a drive letter as a remote host
  run("tar", ["-xzf", fileName], workDir);
  return unpackedDir;
}

async function main() {
  await fs.mkdir(workDir, { recursive: true });
  const platform = hostPlatform();
  const sdkName = `wasi-sdk-${WASI_SDK_VERSION}-${platform}`;
  const sdkDir = await fetchArchive(
    `https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${WASI_SDK_VERSION.split(".")[0]}/${sdkName}.tar.gz`,
    WASI_SDK_DIGESTS[platform],
    `${sdkName}.tar.gz`,
    sdkName,
  );
  const sourceDirs = {};
  for (const [name, source] of Object.entries(SOURCES)) {
    const repoName = source.repo.split("/")[1];
    sourceDirs[name] = await fetchArchive(
      `https://codeload.github.com/${source.repo}/tar.gz/${source.commit}`,
      source.sha256,
      `${repoName}-${source.commit}.tar.gz`,
      `${repoName}-${source.commit}`,
    );
  }

  const exe = process.platform === "win32" ? ".exe" : "";
  const clang = path.join(sdkDir, "bin", `clang${exe}`);
  const clangxx = path.join(sdkDir, "bin", `clang++${exe}`);
  const sysroot = path.join(sdkDir, "share", "wasi-sysroot");
  const targetFlags = ["--target=wasm32-wasip1", `--sysroot=${sysroot}`];
  const commonFlags = [
    ...targetFlags,
    "-O2",
    "-DNDEBUG",
    "-D_LARGEFILE_SOURCE",
    "-D_FILE_OFFSET_BITS=64",
    "-D_IS_NEED_ALL_CompressPlugin=0",
    "-D_IS_NEED_DEFAULT_CompressPlugin=0",
    "-D_IS_NEED_ALL_ChecksumPlugin=0",
    "-D_IS_NEED_DEFAULT_ChecksumPlugin=0",
    "-D_IS_NEED_BSDIFF=1",
    "-D_IS_NEED_VCDIFF=0",
    "-D_CompressPlugin_bz2",
    "-D_IS_NEED_DIR_DIFF_PATCH=0",
    "-D_IS_USED_MULTITHREAD=0",
    `-I${sourceDirs.bzip2}`,
  ];

  const objDir = path.join(workDir, `obj-${SOURCES.hdiffpatch.commit}`);
  await fs.rm(objDir, { recursive: true, force: true });
  await fs.mkdir(objDir, { recursive: true });
  const compile = (compiler, extraFlags, sourceDir, source) => {
    const objectPath = path.join(objDir, `${source.replace(/[/.]/g, "_")}.o`);
    run(compiler, [...commonFlags, ...extraFlags, "-c", source, "-o", objectPath], sourceDir);
    return objectPath;
  };
  const objects = [
    ...BZIP2_SOURCES.map((source) => compile(clang, [], sourceDirs.bzip2, source)),
    ...HDIFFPATCH_C_SOURCES.map((source) => compile(clang, [], sourceDirs.hdiffpatch, source)),
    ...HDIFFPATCH_CXX_SOURCES.map((source) =>
      compile(clangxx, ["-std=c++11", ...EXCEPTION_FLAGS], sourceDirs.hdiffpatch, source),
    ),
  ];

  await fs.mkdir(outputDir, { recursive: true });
  const wasmPath = path.join(outputDir, "hdiffz.wasm");
  run(
    clangxx,
    [
      ...targetFlags,
      ...EXCEPTION_FLAGS,
      ...objects,
      `-L${path.join(sysroot, "lib", "wasm32-wasip1", "eh")}`,
      "-lunwind",
      "-Wl,--max-memory=4294967296",
      "-Wl,-z,stack-size=8388608",
      "-Wl,--strip-debug",
      "-o",
      wasmPath,
    ],
    workDir,
  );
  await Promise.all(
    [
      [sourceDirs.hdiffpatch, "LICENSE-HDiffPatch.txt"],
      [sourceDirs.bzip2, "LICENSE-bzip2.txt"],
    ].map(([sourceDir, fileName]) =>
      fs.copyFile(path.join(sourceDir, "LICENSE"), path.join(outputDir, fileName)),
    ),
  );

  const wasm = await fs.readFile(wasmPath);
  console.log(
    `wrote ${wasmPath} (${wasm.length} bytes, sha256 ${createHash("sha256").update(wasm).digest("hex")})`,
  );
}

await main();
