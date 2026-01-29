const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const process = require("process");

const projectDir = path.join(__dirname, "dotnetprobe");

let filename = "dotnetprobe";
if (process.platform === "win32") {
  filename = `${filename}.exe`;
}

const outputFile = path.join(__dirname, "..", "assets", filename);

// Check if dotnetprobe.exe already exists
if (fs.existsSync(outputFile)) {
  const stats = fs.statSync(outputFile);
  console.log(
    `dotnetprobe already exists (${Math.round(
      stats.size / 1024,
    )}KB) - skipping build`,
  );
  process.exit(0);
}

console.log("Building dotnetprobe..");

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
  execSync(`dotnet publish -r ${runtimeIdentifier} -o ../../assets`, {
    cwd: projectDir,
    stdio: "inherit",
  });

  // Verify the output file exists
  if (fs.existsSync(outputFile)) {
    const stats = fs.statSync(outputFile);
    console.log(
      `✓ dotnetprobe built successfully (${Math.round(stats.size / 1024)}KB)`,
    );
  } else {
    console.error("✗ dotnetprobe was not created");
    process.exit(1);
  }
} catch (err) {
  console.error("Error building dotnetprobe:", err.message);
  console.log("Skipping dotnetprobe build - .NET SDK may not be installed");

  // Check if the existing exe is present
  if (fs.existsSync(outputFile)) {
    console.log("Using existing dotnetprobe");
  } else {
    console.warn("WARNING: dotnetprobe.exe is missing and could not be built");
  }
}
