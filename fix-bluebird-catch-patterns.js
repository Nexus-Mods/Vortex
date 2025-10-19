const fs = require('fs');
const path = require('path');

// Function to fix Bluebird-specific catch patterns
function fixBluebirdCatchPatterns(content) {
  // Pattern: .catch(ErrorType, err => handler)
  // Replace with: .catch(err => err instanceof ErrorType ? handler : Promise.reject(err))
  
  // First, fix the specific patterns we know about
  content = content.replace(/\.catch\(DataInvalid,\s*err\s*=>/g, '.catch(err => err instanceof DataInvalid ?');
  content = content.replace(/\.catch\(ProcessCanceled,\s*err\s*=>/g, '.catch(err => err instanceof ProcessCanceled ?');
  content = content.replace(/\.catch\(UserCanceled,\s*err\s*=>/g, '.catch(err => err instanceof UserCanceled ?');
  content = content.replace(/\.catch\(ServiceTemporarilyUnavailable,\s*err\s*=>/g, '.catch(err => err instanceof ServiceTemporarilyUnavailable ?');
  content = content.replace(/\.catch\(AlreadyDownloaded,\s*err\s*=>/g, '.catch(err => err instanceof AlreadyDownloaded ?');
  content = content.replace(/\.catch\(NexusError,\s*err\s*=>/g, '.catch(err => err instanceof NexusError ?');
  content = content.replace(/\.catch\(NotSupportedError,\s*err\s*=>/g, '.catch(err => err instanceof NotSupportedError ?');
  content = content.replace(/\.catch\(CycleError,\s*err\s*=>/g, '.catch(err => err instanceof CycleError ?');
  content = content.replace(/\.catch\(TemporaryError,\s*err\s*=>/g, '.catch(err => err instanceof TemporaryError ?');
  content = content.replace(/\.catch\(CleanupFailedException,\s*err\s*=>/g, '.catch(err => err instanceof CleanupFailedException ?');
  content = content.replace(/\.catch\(DownloadIsHTML,\s*err\s*=>/g, '.catch(err => err instanceof DownloadIsHTML ?');
  content = content.replace(/\.catch\(Error,\s*err\s*=>/g, '.catch(err => err instanceof Error ?');
  
  // Fix the end of catch handlers to properly reject non-matching errors
  // This is a simpler approach - look for the pattern and fix it manually
  content = content.replace(/(\.catch\(err => err instanceof \w+ \?)((?:[^}](?!Promise\.reject))*})\s*\)/g, '$1$2 : Promise.reject(err))');
  
  return content;
}

// Function to fix Promise helper patterns
function fixPromiseHelpers(content) {
  // Replace Bluebird-specific helpers with native Promise equivalents
  return content
    .replace(/Promise\.map\(/g, 'promiseMap(')
    .replace(/Promise\.filter\(/g, 'promiseFilter(')
    .replace(/Promise\.reduce\(/g, 'promiseReduce(')
    .replace(/Promise\.each\(/g, 'promiseEach(')
    .replace(/Promise\.join\(/g, 'promiseJoin(')
    .replace(/Promise\.delay\(/g, 'promiseDelay(')
    .replace(/Promise\.any\(/g, 'promiseAny(')
    .replace(/Promise\.props\(/g, 'promiseProps(')
    .replace(/Promise\.settle\(/g, 'promiseSettle(');
}

// Function to fix Promise inspection patterns
function fixPromiseInspection(content) {
  // Replace Promise inspection methods
  return content
    .replace(/\.isFulfilled\(\)/g, '.status === "fulfilled"')
    .replace(/\.isRejected\(\)/g, '.status === "rejected"')
    .replace(/\.value\(\)/g, '.value')
    .replace(/\.reason\(\)/g, '.reason')
    .replace(/\.reflect\(\)/g, '');
}

// Function to fix a specific file
function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`Processing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Apply fixes
  content = fixBluebirdCatchPatterns(content);
  content = fixPromiseHelpers(content);
  content = fixPromiseInspection(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
  } else {
    console.log(`No changes needed for ${filePath}`);
  }
}

// Main execution
const filesToFix = [
  // Add all files that contain Bluebird patterns
  'src/extensions/download_management/DownloadManager.ts',
  'src/extensions/download_management/DownloadObserver.ts',
  'src/extensions/extension_manager/index.ts',
  'src/extensions/extension_manager/util.ts',
  'src/extensions/mod_management/LinkingDeployment.ts',
  'src/extensions/mod_management/views/DeactivationButton.tsx',
  'src/extensions/mod_management/views/ModList.tsx',
  'src/extensions/mod_management/views/Settings.tsx',
  'src/extensions/nexus_integration/eventHandlers.ts',
  'extensions/collections/src/views/CollectionPageView/index.tsx',
  'extensions/game-pillarsofeternity2/src/index.ts',
  'extensions/gamebryo-archive-invalidation/src/bsaRedirection.ts',
  'extensions/gamebryo-plugin-management/src/util/PluginPersistor.ts',
  'extensions/local-gamesettings/src/index.ts',
  'extensions/mod-dependency-manager/src/index.tsx'
];

console.log('Starting to fix Bluebird-specific patterns...');

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  try {
    fixFile(fullPath);
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('Finished fixing Bluebird-specific patterns.');