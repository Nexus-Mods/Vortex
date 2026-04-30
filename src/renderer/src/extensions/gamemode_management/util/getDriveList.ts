import { readFile } from "fs/promises";
import type { IExtensionApi } from "../../../types/IExtensionContext";

/**
 * Returns mount paths for fixed (non-removable) system drives.
 * Uses koffi FFI to call Win32 APIs on Windows, /proc/mounts on Linux.
 */
function getDriveList(api: IExtensionApi): Promise<string[]> {
  const impl =
    process.platform === "win32" ? getFixedDrivesWindows : getFixedDrivesLinux;

  return impl().catch((err) => {
    api.showErrorNotification(
      "Failed to determine list of disk drives. " +
        "Please review the settings before scanning for games.",
      err,
      { allowReport: false },
    );
    return ["C:"];
  });
}

/**
 * Enumerate fixed drives via Win32 GetLogicalDriveStringsW + GetDriveTypeW.
 *
 * GetLogicalDriveStringsW returns a double-null-terminated buffer of drive
 * root paths ("C:\\\0D:\\\0\0"). GetDriveTypeW returns the type for each;
 * DRIVE_FIXED (3) is what we want.
 */
function getFixedDrivesWindows(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const koffi = require("koffi");
  const kernel32 = koffi.load("kernel32.dll");

  const GetLogicalDriveStringsW = kernel32.func(
    "uint32 GetLogicalDriveStringsW(uint32 nBufferLength, uint16 *lpBuffer)",
  );
  const GetDriveTypeW = kernel32.func(
    "uint32 GetDriveTypeW(const uint16 *lpRootPathName)",
  );

  const DRIVE_FIXED = 3;

  // Buffer for drive strings — 26 drives * 4 chars ("X:\\\0") = 104 UTF-16 code units max
  const buf = Buffer.alloc(256);
  const len = GetLogicalDriveStringsW(buf.length / 2, buf) as number;

  if (len === 0) {
    return Promise.resolve(["C:"]);
  }

  const drives: string[] = [];
  let offset = 0;

  while (offset < len * 2) {
    // Read null-terminated UTF-16LE string
    const codes: number[] = [];
    while (offset < buf.length) {
      const code = buf.readUInt16LE(offset);
      offset += 2;
      if (code === 0) break;
      codes.push(code);
    }
    if (codes.length === 0) break;

    const rootPath = String.fromCharCode(...codes); // e.g. "C:\\"

    // Check drive type
    const widePath = Buffer.alloc((rootPath.length + 1) * 2);
    for (let i = 0; i < rootPath.length; i++) {
      widePath.writeUInt16LE(rootPath.charCodeAt(i), i * 2);
    }

    const driveType = GetDriveTypeW(widePath) as number;
    if (driveType === DRIVE_FIXED) {
      // Strip trailing backslash: "C:\\" → "C:"
      drives.push(rootPath.replace(/\\$/, ""));
    }
  }

  return Promise.resolve(drives.length > 0 ? drives : ["C:"]);
}

async function getFixedDrivesLinux(): Promise<string[]> {
  const raw = await readFile("/proc/mounts", "utf8");
  const drives = raw
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(" ");
      return { device: parts[0], mountpoint: parts[1], fstype: parts[2] };
    })
    .filter(
      ({ device, fstype }) =>
        device.startsWith("/dev/") &&
        !device.startsWith("/dev/loop") &&
        ["ext4", "btrfs", "xfs", "zfs", "ext3", "ext2", "f2fs"].includes(
          fstype,
        ),
    )
    .map(({ mountpoint }) =>
      // Unescape octal sequences in mount paths (e.g. \040 for space)
      mountpoint.replace(/\\([0-7]{3})/g, (_, oct) =>
        String.fromCharCode(parseInt(oct, 8)),
      ),
    );

  return drives.length > 0 ? drives : ["/"];
}

export default getDriveList;
