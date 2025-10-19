const fs = require('fs');
const path = require('path');

// Get all extension package.json files
const extensionsDir = path.join(__dirname, 'extensions');
const extensionDirs = fs.readdirSync(extensionsDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => path.join(extensionsDir, dirent.name));

extensionDirs.forEach(extDir => {
  const packageJsonPath = path.join(extDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Remove bluebird from devDependencies if it exists
      if (packageJson.devDependencies && packageJson.devDependencies.bluebird) {
        delete packageJson.devDependencies.bluebird;
        console.log(`Removed bluebird from ${packageJsonPath}`);
      }
      
      // Write the updated package.json back to disk
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    } catch (err) {
      console.error(`Error processing ${packageJsonPath}:`, err.message);
    }
  }
});

console.log('Finished removing bluebird dependencies from extension package.json files');