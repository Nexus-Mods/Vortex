const path = require('path');
const sass = require('sass');
const fs = require('fs');

// List of all extension SCSS files to test
const extensionSCSSFiles = [
  // Already fixed extensions
  'extensions/documentation/src/stylesheets/documentation.scss',
  'extensions/collections/style.scss',
  'extensions/issue-tracker/src/issue_tracker.scss',
  
  // Other extensions to check
  'extensions/titlebar-launcher/titlebar-launcher.scss',
  'extensions/mod-content/src/mod-content.scss',
  'extensions/gamebryo-savegame-management/src/stylesheets/savegame_management.scss',
  'extensions/game-pillarsofeternity2/src/stylesheet.scss',
  'extensions/mod-dependency-manager/src/stylesheets/node-content-renderer.scss',
  'extensions/mod-dependency-manager/src/stylesheets/dependency-manager.scss',
  'extensions/mo-import/src/stylesheets/mo-import.scss',
  'extensions/meta-editor/src/stylesheets/metaeditor.scss',
  'extensions/gamebryo-plugin-management/src/stylesheets/plugin_management.scss',
  'extensions/morrowind-plugin-management/src/stylesheet.scss',
  'extensions/mod-highlight/src/stylesheets/mod-highlight.scss',
  'extensions/feedback/src/stylesheets/feedback.scss',
  'extensions/changelog-dashlet/src/changelog.scss',
  'extensions/script-extender-error-check/src/style.scss',
  'extensions/nmm-import-tool/src/stylesheets/import-tool.scss',
  'extensions/extension-dashlet/src/extensions-dashlet.scss',
  'extensions/games/game-masterchiefcollection/masterchief.scss',
  'extensions/games/game-stardewvalley/sdvstyle.scss'
];

// Include paths for SASS compilation
const includePaths = [
  path.join(__dirname, 'src', 'stylesheets'),
  path.join(__dirname, 'app', 'assets', 'css'),
  path.join(__dirname, 'src', 'stylesheets', 'bootstrap'),
  path.join(__dirname, 'src', 'stylesheets', 'bootstrap', 'bootstrap')
];

console.log('Testing SASS compilation for all extensions...\n');

let passed = 0;
let failed = 0;

for (const scssFile of extensionSCSSFiles) {
  const fullPath = path.join(__dirname, scssFile);
  
  if (fs.existsSync(fullPath)) {
    try {
      const result = sass.renderSync({
        file: fullPath,
        includePaths: includePaths,
        outputStyle: 'compressed'
      });
      
      console.log(`✓ ${scssFile} - SUCCESS (${result.css.length} bytes)`);
      passed++;
    } catch (error) {
      console.error(`✗ ${scssFile} - FAILED`);
      console.error(`  Error: ${error.message}`);
      if (error.formatted) {
        console.error(`  Details: ${error.formatted.split('\n')[0]}`);
      }
      failed++;
    }
  } else {
    console.log(`? ${scssFile} - NOT FOUND`);
  }
}

console.log(`\nSummary: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}