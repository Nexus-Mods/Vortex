const fs = require('fs');
const path = require('path');
const semver = require('semver');

const packageJsonPath = path.join(__dirname, '..', 'app', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const constantsPath = path.join(__dirname, '..', 'src', 'constants.ts');
const currentVersion = packageJson.version;
const coercedVersion = semver.coerce(currentVersion);
const versionParts = coercedVersion.version.split('.');
let constantsContent = fs.readFileSync(constantsPath, 'utf8');
constantsContent = constantsContent.replace(/VORTEX_MAJOR: string = '.*?';/, `VORTEX_MAJOR: string = '${versionParts[0]}';`);
constantsContent = constantsContent.replace(/VORTEX_MINOR: string = '.*?';/, `VORTEX_MINOR: string = '${versionParts[1]}';`);
constantsContent = constantsContent.replace(/VORTEX_PATCH: string = '.*?';/, `VORTEX_PATCH: string = '${versionParts[2]}';`);
fs.writeFileSync(constantsPath, constantsContent, 'utf8');
