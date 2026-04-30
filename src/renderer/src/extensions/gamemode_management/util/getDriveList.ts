import { execFile } from "child_process";
import { readFile } from "fs/promises";
import type { IExtensionApi } from "../../../types/IExtensionContext";

/**
 * Returns mount paths for fixed (non-removable) system drives.
 * Uses PowerShell on Windows and /proc/mounts on Linux — no native addons needed.
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

function getFixedDrivesWindows(): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object -ExpandProperty DeviceID",
      ],
      (err, stdout) => {
        if (err) {
          return reject(err);
        }
        const drives = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((d) => /^[A-Z]:$/i.test(d));

        resolve(drives.length > 0 ? drives : ["C:"]);
      },
    );
  });
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
