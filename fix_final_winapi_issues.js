const fs = require('fs');
const path = require('path');

// Final precise winapi fixes
class FinalWinapiFixer {
  constructor() {
    this.extensionsDir = path.join(__dirname, 'extensions');
    this.fixedFiles = [];
    this.errors = [];
  }

  // Check if a winapi call is actually unguarded (not in a ternary or conditional)
  isActuallyUnguarded(content, line, lineIndex) {
    // Skip if it's already in a ternary expression
    if (line.includes('?') && line.includes(':')) {
      return false;
    }
    
    // Skip if it's already in a conditional
    if (line.includes('if (') || line.includes('&& winapi')) {
      return false;
    }
    
    // Check surrounding context for platform guards
    const lines = content.split('\n');
    const checkRange = 15;
    const start = Math.max(0, lineIndex - checkRange);
    const end = Math.min(lines.length - 1, lineIndex + 5);
    
    for (let i = start; i <= end; i++) {
      const contextLine = lines[i];
      if (contextLine.includes('isWindows()') || contextLine.includes('process.platform')) {
        return false;
      }
    }
    
    return true;
  }

  // Fix specific problematic files
  fixSpecificFiles() {
    const problematicFiles = [
      {
        path: 'fnis-integration/src/fnis.ts',
        fixes: [
          {
            search: /const hwnds = winapi\.GetProcessWindowList\(pid\);/,
            replace: 'const hwnds = (isWindows() && winapi) ? winapi.GetProcessWindowList(pid) : [];'
          },
          {
            search: /winapi\.SetForegroundWindow\(hwnd\);/,
            replace: 'if (isWindows() && winapi) { winapi.SetForegroundWindow(hwnd); }'
          }
        ]
      },
      {
        path: 'test-setup/src/index.ts',
        fixes: [
          {
            search: /winapi\.WithRegOpen\(/,
            replace: 'if (isWindows() && winapi) { winapi.WithRegOpen('
          }
        ]
      },
      {
        path: 'feedback/src/index.tsx',
        fixes: [
          {
            search: /const msxml = winapi\.GetModuleList\(null\)\.find\(mod => mod\.module\.match\(reMatch\)\);/,
            replace: 'const msxml = winapi.GetModuleList(null).find(mod => mod.module.match(reMatch));'
          }
        ]
      },
      {
        path: 'games/game-worldoftanks/index.js',
        fixes: [
          {
            search: /winapi\.WithRegOpen\('HKEY_CURRENT_USER', 'Software\\\\Wargaming\.net\\\\Launcher\\\\Apps\\\\wot', hkey => \{/,
            replace: 'if (isWindows() && winapi) { winapi.WithRegOpen(\'HKEY_CURRENT_USER\', \'Software\\\\Wargaming.net\\\\Launcher\\\\Apps\\\\wot\', hkey => {'
          }
        ]
      },
      {
        path: 'gamestore-xbox/src/index.ts',
        fixes: [
          {
            search: /winapi\.WithRegOpen\('HKEY_CLASSES_ROOT', REPOSITORY_PATH, hkey => \{/,
            replace: 'if (isWindows() && winapi) { winapi.WithRegOpen(\'HKEY_CLASSES_ROOT\', REPOSITORY_PATH, hkey => {'
          }
        ]
      },
      {
        path: 'nmm-import-tool/src/util/util.ts',
        fixes: [
          {
            search: /const rootPath = winapi\.GetVolumePathName\(dirPath\);/,
            replace: 'const rootPath = (isWindows() && winapi) ? winapi.GetVolumePathName(dirPath) : dirPath;'
          },
          {
            search: /const totalFreeBytes = winapi\.GetDiskFreeSpaceEx\(rootPath\)\.free - MIN_DISK_SPACE_OFFSET;/,
            replace: 'const totalFreeBytes = (isWindows() && winapi) ? winapi.GetDiskFreeSpaceEx(rootPath).free - MIN_DISK_SPACE_OFFSET : 0;'
          },
          {
            search: /const processes = winapi\.GetProcessList\(\);/,
            replace: 'const processes = (isWindows() && winapi) ? winapi.GetProcessList() : [];'
          }
        ]
      },
      {
        path: 'gamestore-gog/src/index.ts',
        fixes: [
          {
            search: /const gogPath = winapi\.RegGetValue\('HKEY_LOCAL_MACHINE',/,
            replace: 'const gogPath = (isWindows() && winapi) ? winapi.RegGetValue(\'HKEY_LOCAL_MACHINE\','
          },
          {
            search: /winapi\.WithRegOpen\('HKEY_LOCAL_MACHINE', REG_GOG_GAMES, hkey => \{/,
            replace: 'if (isWindows() && winapi) { winapi.WithRegOpen(\'HKEY_LOCAL_MACHINE\', REG_GOG_GAMES, hkey => {'
          }
        ]
      },
      {
        path: 'gamestore-origin/src/index.ts',
        fixes: [
          {
            search: /const clientPath = winapi\.RegGetValue\('HKEY_LOCAL_MACHINE',/,
            replace: 'const clientPath = (isWindows() && winapi) ? winapi.RegGetValue(\'HKEY_LOCAL_MACHINE\','
          }
        ]
      },
      {
        path: 'gamestore-uplay/src/index.ts',
        fixes: [
          {
            search: /const uplayPath = winapi\.RegGetValue\('HKEY_LOCAL_MACHINE',/,
            replace: 'const uplayPath = (isWindows() && winapi) ? winapi.RegGetValue(\'HKEY_LOCAL_MACHINE\','
          },
          {
            search: /winapi\.WithRegOpen\('HKEY_LOCAL_MACHINE', REG_UPLAY_INSTALLS, hkey => \{/,
            replace: 'if (isWindows() && winapi) { winapi.WithRegOpen(\'HKEY_LOCAL_MACHINE\', REG_UPLAY_INSTALLS, hkey => {'
          }
        ]
      }
    ];

    for (const fileInfo of problematicFiles) {
      this.fixFile(fileInfo);
    }
  }

  // Fix a specific file with its defined fixes
  fixFile(fileInfo) {
    const filePath = path.join(this.extensionsDir, fileInfo.path);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${fileInfo.path}`);
      return;
    }

    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      for (const fix of fileInfo.fixes) {
        if (content.match(fix.search)) {
          content = content.replace(fix.search, fix.replace);
          modified = true;
        }
      }

      // Add necessary closing braces for WithRegOpen fixes
      if (modified && content.includes('WithRegOpen')) {
        content = this.addClosingBraces(content, fileInfo.path);
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        this.fixedFiles.push(filePath);
        console.log(`Fixed: ${fileInfo.path}`);
      } else {
        console.log(`No changes needed: ${fileInfo.path}`);
      }

    } catch (error) {
      this.errors.push({ file: fileInfo.path, error: error.message });
      console.error(`Error processing ${fileInfo.path}: ${error.message}`);
    }
  }

  // Add closing braces for WithRegOpen blocks
  addClosingBraces(content, filePath) {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('if (isWindows() && winapi) { winapi.WithRegOpen(')) {
        // Find the matching closing brace for WithRegOpen
        let braceCount = 0;
        let foundWithRegOpen = false;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          
          if (currentLine.includes('WithRegOpen(')) {
            foundWithRegOpen = true;
          }
          
          // Count braces
          const openBraces = (currentLine.match(/\{/g) || []).length;
          const closeBraces = (currentLine.match(/\}/g) || []).length;
          braceCount += openBraces - closeBraces;
          
          // If we've closed all braces for WithRegOpen, add our closing brace
          if (foundWithRegOpen && braceCount === 0 && j > i) {
            const indent = lines[j].match(/^\s*/)[0];
            lines.splice(j + 1, 0, `${indent}}`);
            break;
          }
        }
      }
    }
    
    return lines.join('\n');
  }

  // Add necessary imports
  addImports() {
    const filesToCheck = [
      'fnis-integration/src/fnis.ts',
      'test-setup/src/index.ts',
      'games/game-worldoftanks/index.js',
      'gamestore-xbox/src/index.ts',
      'nmm-import-tool/src/util/util.ts',
      'gamestore-gog/src/index.ts',
      'gamestore-origin/src/index.ts',
      'gamestore-uplay/src/index.ts'
    ];

    for (const relativePath of filesToCheck) {
      const filePath = path.join(this.extensionsDir, relativePath);
      
      if (!fs.existsSync(filePath)) continue;

      try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        if (content.includes('isWindows()') && !content.includes('isWindows')) {
          if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
            // TypeScript
            if (!content.includes("import { isWindows }") && !content.includes("from 'vortex-api'")) {
              content = "import { isWindows } from 'vortex-api';\n" + content;
              modified = true;
            }
          } else if (filePath.endsWith('.js')) {
            // JavaScript
            if (!content.includes("const { isWindows }") && !content.includes("require('vortex-api')")) {
              content = "const { isWindows } = require('vortex-api');\n" + content;
              modified = true;
            }
          }

          if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Added imports to: ${relativePath}`);
          }
        }
      } catch (error) {
        console.error(`Error adding imports to ${relativePath}: ${error.message}`);
      }
    }
  }

  // Main execution method
  run() {
    console.log('Starting final winapi fixes...');
    
    this.fixSpecificFiles();
    this.addImports();
    
    console.log('\n=== FINAL WINAPI FIX RESULTS ===');
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
    
    console.log('\nFinal winapi fixes completed!');
  }
}

// Run the final fixer
const fixer = new FinalWinapiFixer();
fixer.run();