const fs = require('fs');
const path = require('path');

// Critical extensions that need winapi platform guards
const criticalExtensions = [
  'extensions/feedback/src/index.tsx',
  'extensions/gamestore-gog/src/index.ts',
  'extensions/gamestore-origin/src/index.ts', 
  'extensions/gamestore-xbox/src/index.ts',
  'extensions/modtype-gedosato/src/index.ts',
  'extensions/modtype-umm/src/ummDownloader.ts',
  'extensions/nmm-import-tool/src/util/util.ts',
  'extensions/test-setup/src/index.ts'
];

function addPlatformGuards(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Check if file already has conditional winapi import
    if (content.includes('import winapi from \'winapi-bindings\'') || 
        content.includes('import * as winapi from \'winapi-bindings\'')) {
      
      // Replace unconditional import with conditional
      content = content.replace(
        /import\s+(?:\*\s+as\s+)?winapi\s+from\s+['"]winapi-bindings['"];?/g,
        '// Conditional winapi import - only available on Windows\nconst isWindows = () => process.platform === \'win32\';\nconst winapi = isWindows() ? require(\'winapi-bindings\') : undefined;'
      );
      modified = true;
    }

    // Add platform guards to unguarded winapi calls
    const winapiCallRegex = /^(\s*)(?!.*isWindows\(\))(?!.*process\.platform)(.*)winapi\.([A-Za-z][A-Za-z0-9]*)\(/gm;
    
    content = content.replace(winapiCallRegex, (match, indent, prefix, methodName) => {
      // Skip if already in a conditional block or has platform check
      if (prefix.includes('isWindows()') || prefix.includes('process.platform')) {
        return match;
      }
      
      // Add platform guard
      modified = true;
      return `${indent}if (isWindows() && winapi) {\n${indent}  ${prefix}winapi.${methodName}(`;
    });

    // Fix any unmatched braces by adding closing braces where needed
    if (modified) {
      // Simple heuristic: count opening braces added and ensure they're closed
      const openBraces = (content.match(/if \(isWindows\(\) && winapi\) \{/g) || []).length;
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('if (isWindows() && winapi) {')) {
          // Find the end of this winapi call and add closing brace
          let braceCount = 1;
          let j = i + 1;
          
          while (j < lines.length && braceCount > 0) {
            const line = lines[j];
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            // If we find the end of the winapi call, add closing brace
            if (line.includes(');') && braceCount === 1) {
              lines[j] = line + '\n' + lines[i].match(/^(\s*)/)[1] + '}';
              braceCount = 0;
              break;
            }
            j++;
          }
        }
      }
      
      content = lines.join('\n');
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Fixed winapi usage in: ${filePath}`);
    } else {
      console.log(`No changes needed in: ${filePath}`);
    }

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function main() {
  console.log('Fixing critical winapi extensions...');
  
  criticalExtensions.forEach(filePath => {
    addPlatformGuards(filePath);
  });
  
  console.log('Critical winapi fixes completed!');
}

main();