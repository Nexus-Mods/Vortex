const lockfile = require("@yarnpkg/lockfile");
const fs = require("fs");

const develLock = lockfile.parse(
  fs.readFileSync("yarn.lock", { encoding: "utf8" }),
).object;
const develPackage = JSON.parse(
  fs.readFileSync("package.json", { encoding: "utf8" }),
).dependencies;
const releaseLock = lockfile.parse(
  fs.readFileSync("app/yarn.lock", { encoding: "utf8" }),
).object;
const releasePackage = JSON.parse(
  fs.readFileSync("app/package.json", { encoding: "utf8" }),
).dependencies;

function checkVersions() {
  let valid = true;

  Object.keys(releaseLock).forEach((key) => {
    if (key[0] === "@" || key[1] === "@") {
      return;
    }

    const id = key.split("@");
    if (releasePackage[id[0]] !== id[1]) {
      // only check the packages we resolve directly
      return;
    }

    const devKey = Object.keys(develLock).find((iter) =>
      id[1].startsWith("file") ? iter.split("@")[0] === id[0] : iter === key,
    );
    if (devKey === undefined) {
      console.log("No entry in dev found", key);
      return;
    }

    if (develLock[devKey].version !== releaseLock[key].version) {
      console.error(
        "Version mismatch!",
        key,
        releaseLock[key].version,
        "vs",
        develLock[devKey].version,
      );
      valid = false;
    } else if (develLock[devKey].resolved !== releaseLock[key].resolved) {
      console.error("Same version but different commit id", key);
    }
  });
  return valid;
}

function checkDevPackages() {
  let valid = true;
  Object.keys(develPackage).forEach((pkg) => {
    if (releasePackage[pkg] === undefined) {
      console.error("Package not referenced in release", pkg);
      valid = false;
    } else if (
      !releasePackage[pkg].startsWith("file") &&
      releasePackage[pkg] !== develPackage[pkg]
    ) {
      console.error(
        "Referenced version mismatch",
        pkg,
        releasePackage[pkg],
        "vs",
        develPackage[pkg],
      );
      valid = false;
    }
  });
  return valid;
}

function checkRelPackages() {
  let valid = true;
  Object.keys(releasePackage).forEach((pkg) => {
    if (develPackage[pkg] === undefined) {
      console.error("Package not referenced in devel", pkg);
      valid = false;
    }
  });
  return valid;
}

const success = checkRelPackages() && checkDevPackages() && checkVersions();

if (success) {
  console.log("packages are valid");
} else {
  console.error("packages are invalid");
}

process.exit(success ? 0 : 1);
