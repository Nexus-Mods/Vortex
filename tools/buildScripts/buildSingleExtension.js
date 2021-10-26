'use strict';


/**
 * I made this build script since some times I just want to build one specific extension and get it's dist in the bundledPlugins
 * without having to manually move it, or having to change directory in my cmd too many times
 * To use it either in the cmd run `node buildSingleExtension.js extension-name-here` or `yarn buildext extension-name-here`
 * I was thinking about using Inquirer.JS to autocomplete the paramsm but for now it is okay to just write it properly
 */

const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

const rootPath = path.resolve(__dirname, '..', '..')

const [extensionName, buildScript = 'build'] = process.argv.slice(2);

if (!extensionName) {
  console.error('❌ You must pass at least the extension name');
  process.exit(0)
}

const extensionPath = path.resolve(rootPath, 'extensions', extensionName);

if (!fs.existsSync(extensionPath)) {
  console.error(`❌ No folder found with name ${extensionPath}`);
  process.exit(0)
}

console.log(`🔨 Found extension ${extensionPath}, building using "${buildScript}" script`);
console.log(`🔨 Building...`);

const exe = 'yarn.cmd';
const args = [ 'run', buildScript, '--mutex', 'file' ];
// Using `shell: true and stdio: 'inherit'` to keep the console output from the build script without having to hook on proc.stdout.on
const options = { cwd: `extensions/${extensionName}`, shell: true, stdio: 'inherit' };

const proc = spawn(exe, args, options);
// Yeah, I know, I should handle the `on error`  
proc.on('close', (code) => {
  console.log(`child process exited with code ${code}`);

  console.log(`✅ Build done`);
  console.log(`🔨 Now copying "dist" to "out/bundledPlugins/${extensionName}"`);

  fs.copy(path.join(extensionPath, 'dist'), path.resolve(rootPath, 'out', 'bundledPlugins', extensionName), { overwrite: true }).then(()=> {
    console.log(`✅ Copy successful`)
  })
});