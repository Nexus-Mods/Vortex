const fs = require('fs');
const path = require('path');

// Files that need to be fixed in collections extension
const filesToFix = [
  'extensions/collections/src/views/CollectionPageView/HealthDownvoteDialog.tsx',
  'extensions/collections/src/views/CollectionList/StartPage.tsx',
  'extensions/collections/src/views/CollectionPageView/CollectionInstructions.tsx',
  'extensions/collections/src/views/IniTweaks.tsx',
  'extensions/collections/src/views/CollectionTile/index.tsx',
  'extensions/collections/src/views/CollectionPageEdit/InstallModeRenderer.tsx',
  'extensions/collections/src/views/CollectionModsPageAttributeRenderer.tsx',
  'extensions/collections/src/views/CollectionPageView/Timer.tsx',
  'extensions/collections/src/util/gameSupport/gamebryo.tsx',
  'extensions/collections/src/views/CollectionPageEdit/ModRules.tsx',
  'extensions/collections/src/views/CollectionPageView/HealthIndicator.tsx',
  'extensions/collections/src/views/CollectionPageView/CollectionItemStatus.tsx',
  'extensions/collections/src/views/Tools.tsx',
  'extensions/collections/src/views/CollectionTile/SuccessRating.tsx',
  'extensions/collections/src/views/InstallDialog/InstallFinishedDialog.tsx',
  'extensions/collections/src/views/InstallDialog/InstallStartDialog.tsx',
  'extensions/collections/src/views/InstallDialog/InstallChangelogDialog.tsx',
  'extensions/collections/src/views/CollectionPageEdit/Instructions.tsx',
  'extensions/collections/src/views/CollectionPageView/SlideshowControls.tsx',
  'extensions/collections/src/views/CollectionPageView/CollectionProgress.tsx',
  'extensions/collections/src/views/CollectionTile/RemoteTile.tsx',
  'extensions/collections/src/views/CollectionPageView/index.tsx',
  'extensions/collections/src/views/CollectionPageEdit/index.tsx',
  'extensions/collections/src/views/AddModsDialog.tsx',
  'extensions/collections/src/views/CollectionTile/NewRevisionMarker.tsx',
  'extensions/collections/src/views/CollectionPageEdit/ModsEditPage.tsx',
  'extensions/collections/src/views/CollectionPageEdit/FileOverrides.tsx',
  'extensions/collections/src/views/CollectionReleaseStatus.tsx',
  'extensions/collections/src/views/InstallDialog/index.tsx',
  'extensions/collections/src/views/CollectionPageView/CollectionOverviewSelection.tsx',
  'extensions/collections/src/views/InstallDialog/YouCuratedThisTag.tsx',
  'extensions/collections/src/views/CollectionPageView/CollectionBanner.tsx',
  'extensions/collections/src/views/CollectionPageView/CollectionModDetails.tsx',
  'extensions/collections/src/views/CollectionPageView/CollectionOverview.tsx'
];

let fixedCount = 0;

filesToFix.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace the incorrect import path with the correct one
      const oldImport = "../../../../api/lib/util/platform";
      const newImport = "../../../../../api/lib/util/platform";
      
      if (content.includes(oldImport)) {
        content = content.replace(new RegExp(oldImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newImport);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${filePath}`);
        fixedCount++;
      }
    } else {
      console.log(`File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
});

console.log(`\nFixed ${fixedCount} files in collections extension.`);