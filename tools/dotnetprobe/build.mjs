import { execSync } from "child_process";
import * as process from "node:process";

try {
  // Check if dotnet is available
  execSync("dotnet --version", { stdio: "pipe" });

  let runtimeIdentifier;
  if (process.platform === "win32") {
    runtimeIdentifier = "win-x64";
  } else if (process.platform === "linux") {
    runtimeIdentifier = "linux-x64";
  } else {
    console.error(`Platform ${process.platform} is unsupported`);
    process.exit(1);
  }

  // Build dotnetprobe
  execSync(`dotnet publish -r ${runtimeIdentifier} -o dist`, {
    cwd: import.meta.dirname,
    stdio: "inherit",
  });
} catch (err) {
  console.error("Error building dotnetprobe:", err.message);
}
