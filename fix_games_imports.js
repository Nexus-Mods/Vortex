const fs = require('fs');
const path = require('path');

// Files that need to be fixed based on the TypeScript error output
const filesToFix = [
  'extensions/games/game-7daystodie/index.tsx',
  'extensions/games/game-7daystodie/Settings.tsx',
  'extensions/games/game-baldursgate3/index.tsx',
  'extensions/games/game-baldursgate3/InfoPanel.tsx',
  'extensions/games/game-baldursgate3/migrations.tsx',
  'extensions/games/game-baldursgate3/Settings.tsx',
  'extensions/games/game-baldursgate3/types.tsx',
  'extensions/games/game-stardewvalley/CompatibilityIcon.tsx',
  'extensions/games/game-stardewvalley/Settings.tsx',
  'extensions/games/game-witcher3/loadOrder.tsx'
];

const oldPath = '../../api/lib/util/platform';
const newPath = '../../../api/lib/util/platform';

console.log('Fixing games extension import paths...');

filesToFix.forEach(filePath => {
  try {
    const fullPath = path.join(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.includes(oldPath)) {
      const updatedContent = content.replace(
        new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        newPath
      );
      
      fs.writeFileSync(fullPath, updatedContent, 'utf8');
      console.log(`Fixed: ${filePath}`);
    } else {
      console.log(`No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log('Games extension import path fixes completed.');