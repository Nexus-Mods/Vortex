const lockfile = require('@yarnpkg/lockfile');
const fs = require('fs');
const path = require('path');

const develLock = lockfile.parse(fs.readFileSync('yarn.lock', { encoding: 'utf8' })).object;
const develPackageJson = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }));
const develPackage = { ...develPackageJson.dependencies, ...develPackageJson.optionalDependencies };
const releaseLock = lockfile.parse(fs.readFileSync('app/yarn.lock', { encoding: 'utf8' })).object;
const releasePackageJson = JSON.parse(fs.readFileSync('app/package.json', { encoding: 'utf8' }));
const releasePackage = { ...releasePackageJson.dependencies, ...releasePackageJson.optionalDependencies };

function checkVersions() {
  let valid = true;

  Object.keys(releaseLock).forEach(key => {
    if ((key[0] === '@') || (key[1] === '@')) {
      return;
    }

    const id = key.split('@');
    if (releasePackage[id[0]] !== id[1]) {
      // only check the packages we resolve directly
      return;
    }
  
    const devKey = Object.keys(develLock).find(iter => (id[1].startsWith('file'))
      ? iter.split('@')[0] === id[0]
      : iter === key);
    if (devKey === undefined) {
      console.log('❓ No entry in dev found:', key);
      return;
    }

    if (develLock[devKey].version !== releaseLock[key].version) {
      console.error('❌ Version mismatch!', key, releaseLock[key].version, 'vs', develLock[devKey].version);
      valid = false;
    } else if (develLock[devKey].resolved !== releaseLock[key].resolved) {
      console.error('⚠️ Same version but different commit id:', key);
    }
  });
  return valid;
}

function checkDevelPackages(develPackage, releasePackage) {
  let valid = true;
  Object.keys(develPackage).forEach(pkg => {
    if (releasePackage[pkg] === undefined) {
      console.error('❌ Package not referenced in release:', pkg);
      valid = false;
    } else {
      const devSpec = develPackage[pkg];
      const relSpec = releasePackage[pkg];

      // Normalize local file dependencies by resolving absolute paths relative to their package roots
      if (typeof devSpec === 'string' && typeof relSpec === 'string'
        && devSpec.startsWith('file:') && relSpec.startsWith('file:')) {
        // If specs are identical strings, accept immediately
        if (devSpec === relSpec) {
          return;
        }

        const devPath = devSpec.replace(/^file:/, '');
        const relPath = relSpec.replace(/^file:/, '');

        // Resolve release path relative to app/, but if that doesn't exist, fall back to repo root
        const devResolved = path.resolve('.', devPath);
        let relResolved = path.resolve('app', relPath);
        if (!fs.existsSync(relResolved)) {
          const altRel = path.resolve('.', relPath);
          if (fs.existsSync(altRel)) {
            relResolved = altRel;
          }
        }

        if (devResolved !== relResolved) {
          console.error('❌ Referenced file path mismatch:', pkg, relSpec, 'vs', devSpec);
          valid = false;
        }
      } else if (relSpec !== devSpec) {
        console.error('❌ Referenced version mismatch:', pkg, relSpec, 'vs', devSpec);
        valid = false;
      }
    }
  });
  return valid;
}

function checkReleasePackages(develPackage, releasePackage) {
  let valid = true;
  Object.keys(releasePackage).forEach(pkg => {
    if (develPackage[pkg] === undefined) {
      console.error('❌ Package not referenced in devel:', pkg);
      valid = false;
    }
  });
  return valid;
}

const valid = checkVersions()
  && checkDevelPackages(develPackage, releasePackage)
  && checkReleasePackages(develPackage, releasePackage);

if (valid) {
  console.log('✅ Packages are valid');
  process.exit(0);
} else {
  console.error('❌ Packages are invalid');
  process.exit(1);
}

