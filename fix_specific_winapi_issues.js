const fs = require('fs');
const path = require('path');

// Targeted winapi fixes for specific known issues
class TargetedWinapiFixer {
  constructor() {
    this.extensionsDir = path.join(__dirname, 'extensions');
    this.fixedFiles = [];
    this.errors = [];
    
    // Specific files and their issues that we identified
    this.targetFixes = [
      {
        file: 'feedback/src/index.tsx',
        line: 68,
        issue: 'const msxml = winapi.GetModuleList(null).find(mod => mod.module.match(reMatch));',
        fix: 'Already inside platform guard - should be fine'
      },
      {
        file: 'gamestore-xbox/src/index.ts',
        lines: [30, 32, 199, 201, 241, 243, 248, 251, 261, 283, 315, 317, 321, 350, 352, 388, 407],
        issue: 'Multiple unguarded winapi calls',
        needsWrapping: true
      },
      {
        file: 'test-setup/src/index.ts',
        lines: [33, 38],
        issue: 'winapi calls in try block',
        needsWrapping: true
      },
      {
        file: 'modtype-gedosato/src/index.ts',
        line: 22,
        issue: 'Direct winapi call inside platform-guarded function',
        fix: 'Remove redundant check'
      },
      {
        file: 'nmm-import-tool/src/util/util.ts',
        lines: [70, 84, 249],
        issue: 'Unguarded winapi calls',
        needsWrapping: true
      },
      {
        file: 'gamestore-uplay/src/index.ts',
        lines: [32, 118, 121, 131, 134],
        issue: 'Unguarded winapi calls',
        needsWrapping: true
      },
      {
        file: 'gamestore-origin/src/index.ts',
        line: 57,
        issue: 'Unguarded winapi call',
        needsWrapping: true
      },
      {
        file: 'gamestore-gog/src/index.ts',
        lines: [38, 164, 166, 172, 174, 176],
        issue: 'Unguarded winapi calls',
        needsWrapping: true
      },
      {
        file: 'modtype-umm/src/ummDownloader.ts',
        lines: [141, 159],
        issue: 'Direct winapi calls inside platform-guarded functions',
        fix: 'Already fixed'
      },
      {
        file: 'fnis-integration/src/fnis.ts',
        lines: [235, 240],
        issue: 'Unguarded winapi calls',
        needsWrapping: true
      },
      {
        file: 'games/game-worldoftanks/index.js',
        lines: [18, 19, 24],
        issue: 'Unguarded winapi calls',
        needsWrapping: true
      }
    ];
  }

  // Fix specific file issues
  fixFile(fileInfo) {
    const filePath = path.join(this.extensionsDir, fileInfo.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${fileInfo.file}`);
      return;
    }

    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      const lines = content.split('\n');

      // Apply specific fixes based on file type
      if (fileInfo.needsWrapping) {
        modified = this.wrapWinapiCalls(lines, fileInfo);
      } else if (fileInfo.fix === 'Remove redundant check') {
        modified = this.removeRedundantChecks(lines, fileInfo);
      }

      if (modified) {
        const newContent = lines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf8');
        this.fixedFiles.push(filePath);
        console.log(`Fixed: ${fileInfo.file}`);
      } else {
        console.log(`No changes needed: ${fileInfo.file}`);
      }

    } catch (error) {
      this.errors.push({ file: fileInfo.file, error: error.message });
      console.error(`Error processing ${fileInfo.file}: ${error.message}`);
    }
  }

  // Wrap winapi calls with platform guards
  wrapWinapiCalls(lines, fileInfo) {
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line contains winapi calls and needs wrapping
      if (line.includes('winapi.') && !this.hasNearbyPlatformGuard(lines, i)) {
        const indent = line.match(/^\s*/)[0];
        
        // Different wrapping strategies based on context
        if (line.includes('const ') && line.includes('=') && !line.includes('?')) {
          // Convert assignment to ternary
          const match = line.match(/(const\s+\w+\s*=\s*)(.*)/);
          if (match) {
            const [, declaration, assignment] = match;
            lines[i] = `${indent}${declaration}(isWindows() && winapi) ? ${assignment.trim()} : null;`;
            modified = true;
          }
        } else if (line.trim().startsWith('winapi.')) {
          // Wrap standalone winapi call
          const winapiCall = line.trim();
          lines[i] = `${indent}if (isWindows() && winapi) {`;
          lines.splice(i + 1, 0, `${indent}  ${winapiCall}`);
          lines.splice(i + 2, 0, `${indent}}`);
          modified = true;
          i += 2; // Skip inserted lines
        } else if (line.includes('winapi.') && !line.includes('if')) {
          // Wrap line containing winapi call
          lines[i] = `${indent}if (isWindows() && winapi) {`;
          lines.splice(i + 1, 0, `${indent}  ${line.trim()}`);
          lines.splice(i + 2, 0, `${indent}}`);
          modified = true;
          i += 2;
        }
      }
    }
    
    return modified;
  }

  // Remove redundant platform checks
  removeRedundantChecks(lines, fileInfo) {
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for redundant if (isWindows() && winapi) inside already guarded functions
      if (line.includes('if (isWindows() && winapi)') && this.hasOuterPlatformGuard(lines, i)) {
        // Remove the redundant check and its closing brace
        const indent = line.match(/^\s*/)[0];
        let braceCount = 0;
        let endIndex = i;
        
        // Find the matching closing brace
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].includes('{')) braceCount++;
          if (lines[j].includes('}')) {
            if (braceCount === 0) {
              endIndex = j;
              break;
            }
            braceCount--;
          }
        }
        
        // Remove the redundant if and its closing brace
        lines.splice(endIndex, 1); // Remove closing brace
        lines.splice(i, 1); // Remove if statement
        
        // Adjust indentation of content between
        for (let k = i; k < endIndex - 1; k++) {
          if (lines[k].startsWith(indent + '  ')) {
            lines[k] = lines[k].substring(2); // Remove 2 spaces of indentation
          }
        }
        
        modified = true;
        i--; // Adjust index after removal
      }
    }
    
    return modified;
  }

  // Check if there's a platform guard nearby
  hasNearbyPlatformGuard(lines, lineIndex) {
    const checkRange = 10;
    const start = Math.max(0, lineIndex - checkRange);
    const end = Math.min(lines.length - 1, lineIndex + checkRange);
    
    for (let i = start; i <= end; i++) {
      const line = lines[i];
      if (line.includes('isWindows()') || line.includes('process.platform')) {
        return true;
      }
    }
    return false;
  }

  // Check if there's an outer platform guard (for removing redundant checks)
  hasOuterPlatformGuard(lines, lineIndex) {
    const checkRange = 20;
    const start = Math.max(0, lineIndex - checkRange);
    
    for (let i = start; i < lineIndex; i++) {
      const line = lines[i];
      if (line.includes('if (isWindows()') && !line.includes('&&')) {
        return true;
      }
    }
    return false;
  }

  // Add necessary imports if missing
  addImports(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      if (content.includes('isWindows()') && !content.includes('isWindows')) {
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
          // TypeScript
          if (!content.includes("import { isWindows }")) {
            const importRegex = /^(import.*\n)*/m;
            const match = content.match(importRegex);
            const imports = match ? match[0] : '';
            const newImport = "import { isWindows } from 'vortex-api';\n";
            content = content.replace(imports, imports + newImport);
            modified = true;
          }
        } else if (filePath.endsWith('.js')) {
          // JavaScript
          if (!content.includes("const { isWindows }")) {
            const requireRegex = /^(const.*require.*\n)*/m;
            const match = content.match(requireRegex);
            const requires = match ? match[0] : '';
            const newRequire = "const { isWindows } = require('vortex-api');\n";
            content = content.replace(requires, requires + newRequire);
            modified = true;
          }
        }

        if (modified) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`Added imports to: ${path.relative(this.extensionsDir, filePath)}`);
        }
      }
    } catch (error) {
      console.error(`Error adding imports to ${filePath}: ${error.message}`);
    }
  }

  // Main execution method
  run() {
    console.log('Starting targeted winapi fixes...');
    console.log(`Processing ${this.targetFixes.length} files with known issues`);
    
    for (const fileInfo of this.targetFixes) {
      this.fixFile(fileInfo);
      
      // Add imports if needed
      const filePath = path.join(this.extensionsDir, fileInfo.file);
      if (fs.existsSync(filePath)) {
        this.addImports(filePath);
      }
    }
    
    console.log('\n=== TARGETED WINAPI FIX RESULTS ===');
    console.log(`Files processed: ${this.targetFixes.length}`);
    console.log(`Files fixed: ${this.fixedFiles.length}`);
    console.log(`Errors: ${this.errors.length}`);
    
    if (this.fixedFiles.length > 0) {
      console.log('\nFixed files:');
      this.fixedFiles.forEach(file => {
        console.log(`  - ${path.relative(this.extensionsDir, file)}`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
    }
    
    console.log('\nTargeted winapi fixes completed!');
  }
}

// Run the targeted fixer
const fixer = new TargetedWinapiFixer();
fixer.run();