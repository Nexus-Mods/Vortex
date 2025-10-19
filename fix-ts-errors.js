const fs = require('fs');
const path = require('path');

// Function to fix missing closing braces in Promise chains
function fixMissingClosingBraces(content) {
  // Fix pattern: .catch(err => { if (err.code === 'ENOENT') { ... }) without proper closing
  const pattern1 = /(\.catch\(\s*err\s*=>\s*\{\s*if\s*\(\s*err\.code\s*===\s*['"][^'"]+['"]\s*\)\s*\{[^}]*\)\s*;?\s*)\)/g;
  content = content.replace(pattern1, (match, p1) => {
    return p1 + '}';
  });

  // Fix pattern: .catch(err => { ... }) without proper closing in fsAtomic.ts
  const pattern2 = /(\.catch\(\s*err\s*=>\s*\{\s*if\s*\(\s*err\.code\s*===\s*['"]EEXIST['"]\s*\)\s*\{[^}]*\)\s*;?\s*)\)/g;
  content = content.replace(pattern2, (match, p1) => {
    return p1 + '}';
  });

  return content;
}

// Function to fix function declaration syntax errors
function fixFunctionDeclarations(content) {
  // Fix missing commas in function parameters
  content = content.replace(/private\s+(\w+)\s*\(\s*([^,)]+)\s*:\s*([^,)]+)(\s+)([^,)]+)\s*:\s*([^,)]+)\s*\)/g, 
    'private $1($2: $3, $5: $6)');
  
  content = content.replace(/private\s+(\w+)\s*\(\s*([^,)]+)\s*:\s*([^,)]+)(\s+)([^,)]+)\s*:\s*([^,)]+)(\s+)([^,)]+)\s*:\s*([^,)]+)\s*\)/g, 
    'private $1($2: $3, $5: $6, $8: $9)');
  
  // Fix missing semicolons after function declarations
  content = content.replace(/(\)\s*\{)(\s*let|\s*const|\s*var|\s*this\.|\s*return|\s*if|\s*for|\s*while)/g, '$1\n    $2');
  
  // Fix missing array brackets in type definitions
  content = content.replace(/(\w+):\s*\{\s*\[\s*(\w+):\s*(\w+)\s*\]:\s*(\w+)\s*\}/g, '$1: { [$2: $3]: $4 }[]');
  
  // Fix missing semicolons after function return types
  content = content.replace(/(\)\s*:\s*\w+\s*\[\s*\]\s*)\{/g, '$1 {');
  
  return content;
}

// Function to fix Promise chain structure
function fixPromiseChains(content) {
  // Fix improperly closed Promise chains
  const lines = content.split('\n');
  const fixedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Fix lines that end with }) but should have another }
    if (line.trim().endsWith('})') && !line.trim().endsWith('});')) {
      // Check if this is part of a Promise chain that needs another closing brace
      if (line.includes('.catch') || line.includes('.then')) {
        line = line.replace(/\}\)$/, '});');
      }
    }
    
    fixedLines.push(line);
  }
  
  return fixedLines.join('\n');
}

// Function to fix specific files
function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`Processing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Apply fixes based on file type
  if (filePath.includes('ExtensionManager.ts')) {
    content = fixFunctionDeclarations(content);
    content = fixMissingClosingBraces(content);
  } else if (filePath.includes('fsAtomic.ts')) {
    content = fixMissingClosingBraces(content);
  } else if (filePath.includes('downloadDirectory.ts')) {
    content = fixMissingClosingBraces(content);
  } else if (filePath.includes('util.ts') && filePath.includes('extension_manager')) {
    content = fixMissingClosingBraces(content);
  } else if (filePath.includes('Steam.ts')) {
    content = fixMissingClosingBraces(content);
  } else if (filePath.includes('FileAssembler.ts')) {
    content = fixMissingClosingBraces(content);
  }
  
  // Always apply Promise chain fixes
  content = fixPromiseChains(content);
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
  } else {
    console.log(`No changes needed for ${filePath}`);
  }
}

// Main execution
const filesToFix = [
  'src/extensions/download_management/FileAssembler.ts',
  'src/extensions/download_management/util/downloadDirectory.ts',
  'src/extensions/extension_manager/util.ts',
  'src/util/ExtensionManager.ts',
  'src/util/fsAtomic.ts',
  'src/util/Steam.ts'
];

console.log('Starting to fix TypeScript compilation errors...');

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  try {
    fixFile(fullPath);
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('Finished fixing TypeScript compilation errors.');