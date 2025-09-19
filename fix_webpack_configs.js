#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of webpack.config.js files that need fixing
const webpackConfigs = [
  '/Users/veland/Downloads/vortex/extensions/modtype-dinput/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/quickbms-support/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/changelog-dashlet/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/modtype-bepinex/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/modtype-dazip/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gameversion-hash/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/theme-switcher/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/collections/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamestore-macappstore/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gameinfo-steam/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/morrowind-plugin-management/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/feedback/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/modtype-gedosato/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/modtype-umm/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/game-pillarsofeternity2/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-plugin-indexlock/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-bsa-support/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/mod-highlight/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/new-file-monitor/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-archive-check/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-archive-invalidation/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/meta-editor/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/test-gameversion/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/mod-dependency-manager/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamestore-xbox/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/nmm-import-tool/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-plugin-management/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/mod-content/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/script-extender-installer/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamestore-uplay/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/modtype-enb/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/mtframework-arc-support/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/script-extender-error-check/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-savegame-management/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/documentation/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/open-directory/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/common-interpreters/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-test-settings/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamestore-gog/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/issue-tracker/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/titlebar-launcher/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/mo-import/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/extension-dashlet/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/fnis-integration/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamebryo-ba2-support/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/mod-report/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/gamestore-origin/webpack.config.js',
  '/Users/veland/Downloads/vortex/extensions/test-setup/webpack.config.js'
];

let fixedCount = 0;
let skippedCount = 0;

console.log('Fixing webpack.config.js files...');

webpackConfigs.forEach(configPath => {
  try {
    if (!fs.existsSync(configPath)) {
      console.log(`Skipping ${configPath} - file not found`);
      skippedCount++;
      return;
    }

    const content = fs.readFileSync(configPath, 'utf8');
    
    // Check if it has the problematic import
    if (content.includes("const { isWindows } = require('vortex-api');")) {
      // Remove the line with isWindows import
      const lines = content.split('\n');
      const filteredLines = lines.filter(line => 
        !line.trim().startsWith("const { isWindows } = require('vortex-api');")
      );
      
      const newContent = filteredLines.join('\n');
      fs.writeFileSync(configPath, newContent);
      
      console.log(`Fixed: ${path.basename(path.dirname(configPath))}/webpack.config.js`);
      fixedCount++;
    } else {
      console.log(`Skipping ${path.basename(path.dirname(configPath))}/webpack.config.js - no isWindows import found`);
      skippedCount++;
    }
  } catch (error) {
    console.error(`Error processing ${configPath}:`, error.message);
    skippedCount++;
  }
});

console.log(`\nSummary:`);
console.log(`Fixed: ${fixedCount} files`);
console.log(`Skipped: ${skippedCount} files`);