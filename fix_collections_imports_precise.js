const fs = require('fs');
const path = require('path');

// Files and their correct import paths based on directory depth
const filesToFix = [
  // Files in src/views (5 levels up)
  { file: 'extensions/collections/src/views/AddModsDialog.tsx', correctPath: '../../../../api/lib/util/platform' },
  { file: 'extensions/collections/src/views/CollectionModsPageAttributeRenderer.tsx', correctPath: '../../../../api/lib/util/platform' },
  { file: 'extensions/collections/src/views/CollectionReleaseStatus.tsx', correctPath: '../../../../api/lib/util/platform' },
  { file: 'extensions/collections/src/views/IniTweaks.tsx', correctPath: '../../../../api/lib/util/platform' },
  { file: 'extensions/collections/src/views/Tools.tsx', correctPath: '../../../../api/lib/util/platform' },
  
  // Files in src/views/subdirectories (6 levels up) - these should stay as they are
  // Just checking if any were incorrectly changed
];

let fixedCount = 0;

filesToFix.forEach(({ file, correctPath }) => {
  try {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      
      // Replace any incorrect import path with the correct one
      const incorrectPaths = [
        '../../../../../api/lib/util/platform',
        '../../../../api/lib/util/platform',
        '../../../api/lib/util/platform'
      ];
      
      let wasFixed = false;
      incorrectPaths.forEach(incorrectPath => {
        if (incorrectPath !== correctPath && content.includes(incorrectPath)) {
          content = content.replace(new RegExp(incorrectPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correctPath);
          wasFixed = true;
        }
      });
      
      if (wasFixed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Fixed: ${file} -> ${correctPath}`);
        fixedCount++;
      }
    } else {
      console.log(`File not found: ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nFixed ${fixedCount} files in collections extension.`);