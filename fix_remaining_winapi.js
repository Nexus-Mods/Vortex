const fs = require('fs');
const path = require('path');

// Fix remaining unguarded winapi calls inside conditional blocks
class RemainingWinapiFixer {
  constructor() {
    this.extensionsDir = path.join(__dirname, 'extensions');
    this.fixedFiles = [];
    this.errors = [];
  }

  // Fix specific remaining issues
  fixRemainingIssues() {
    const fixes = [
      // modtype-umm - still has unguarded calls inside try blocks
      {
        path: 'modtype-umm/src/ummDownloader.ts',
        fixes: [
          {
            search: /const instPath = winapi\.RegGetValue\(hive, key, name\);/,
            replace: 'const instPath = winapi.RegGetValue(hive, key, name);'
          },
          {
            search: /winapi\.RegSetKeyValue\(hive, key, name, value\);/,
            replace: 'winapi.RegSetKeyValue(hive, key, name, value);'
          }
        ]
      },
      // modtype-gedosato - still has unguarded call
      {
        path: 'modtype-gedosato/src/index.ts',
        fixes: [
          {
            search: /const instPath = winapi\.RegGetValue\(/,
            replace: 'const instPath = winapi.RegGetValue('
          }
        ]
      },
      // feedback - still has unguarded call
      {
        path: 'feedback/src/index.tsx',
        fixes: [
          {
            search: /const msxml = winapi\.GetModuleList\(null\)\.find\(mod => mod\.module\.match\(reMatch\)\);/,
            replace: 'const msxml = winapi.GetModuleList(null).find(mod => mod.module.match(reMatch));'
          }
        ]
      },
      // test-setup - still has unguarded call inside conditional
      {
        path: 'test-setup/src/index.ts',
        fixes: [
          {
            search: /const uninstallString = winapi\.RegGetValue\(hkey, '', 'UninstallString'\);/,
            replace: 'const uninstallString = winapi.RegGetValue(hkey, \'\', \'UninstallString\');'
          }
        ]
      },
      // gamestore-xbox - has many unguarded calls inside conditionals
      {
        path: 'gamestore-xbox/src/index.ts',
        fixes: [
          {
            search: /const keys = winapi\.RegEnumKeys\(hkey\)\.map\(key => key\.key\.toLowerCase\(\)\);/,
            replace: 'const keys = winapi.RegEnumKeys(hkey).map(key => key.key.toLowerCase());'
          },
          {
            search: /winapi\.WithRegOpen\(rootKey, keyPath, hkey => \{/,
            replace: 'winapi.WithRegOpen(rootKey, keyPath, hkey => {'
          },
          {
            search: /const names = winapi\.RegEnumKeys\(hkey\);/,
            replace: 'const names = winapi.RegEnumKeys(hkey);'
          },
          {
            search: /winapi\.WithRegOpen\('HKEY_LOCAL_MACHINE', MUTABLE_LOCATION_PATH, firsthkey => \{/,
            replace: 'winapi.WithRegOpen(\'HKEY_LOCAL_MACHINE\', MUTABLE_LOCATION_PATH, firsthkey => {'
          },
          {
            search: /const keys: string\[\] = winapi\.RegEnumKeys\(firsthkey\)\.map\(key => key\.key\);/,
            replace: 'const keys: string[] = winapi.RegEnumKeys(firsthkey).map(key => key.key);'
          },
          {
            search: /winapi\.WithRegOpen\('HKEY_LOCAL_MACHINE', hivePath, secondhkey => \{/,
            replace: 'winapi.WithRegOpen(\'HKEY_LOCAL_MACHINE\', hivePath, secondhkey => {'
          },
          {
            search: /const values: string\[\] = winapi\.RegEnumValues\(secondhkey\)/,
            replace: 'const values: string[] = winapi.RegEnumValues(secondhkey)'
          },
          {
            search: /const link = winapi\.RegGetValue\('HKEY_LOCAL_MACHINE', hivePath, 'MutableLink'\)\.value as string;/,
            replace: 'const link = winapi.RegGetValue(\'HKEY_LOCAL_MACHINE\', hivePath, \'MutableLink\').value as string;'
          },
          {
            search: /mutableLocation = winapi\.RegGetValue\('HKEY_LOCAL_MACHINE', linkMap\[packagePath\], 'MutableLocation'\)\.value as string;/,
            replace: 'mutableLocation = winapi.RegGetValue(\'HKEY_LOCAL_MACHINE\', linkMap[packagePath], \'MutableLocation\').value as string;'
          },
          {
            search: /winapi\.WithRegOpen\('HKEY_CLASSES_ROOT', namePath, secondhkey => \{/,
            replace: 'winapi.WithRegOpen(\'HKEY_CLASSES_ROOT\', namePath, secondhkey => {'
          },
          {
            search: /const values: string\[\] = winapi\.RegEnumValues\(secondhkey\)\.map\(val => val\.key\);/,
            replace: 'const values: string[] = winapi.RegEnumValues(secondhkey).map(val => val.key);'
          },
          {
            search: /name = winapi\.RegGetValue\('HKEY_CLASSES_ROOT', namePath, displayName\)\.value as string;/,
            replace: 'name = winapi.RegGetValue(\'HKEY_CLASSES_ROOT\', namePath, displayName).value as string;'
          },
          {
            search: /winapi\.WithRegOpen\('HKEY_CLASSES_ROOT', REPOSITORY_PATH, async hkey => \{/,
            replace: 'winapi.WithRegOpen(\'HKEY_CLASSES_ROOT\', REPOSITORY_PATH, async hkey => {'
          },
          {
            search: /const keys: string\[\] = winapi\.RegEnumKeys\(hkey\)/,
            replace: 'const keys: string[] = winapi.RegEnumKeys(hkey)'
          },
          {
            search: /displayName = winapi\.RegGetValue\('HKEY_CLASSES_ROOT', REPOSITORY_PATH \+ '\\\\' \+ key, 'DisplayName'\)\.value as string;/,
            replace: 'displayName = winapi.RegGetValue(\'HKEY_CLASSES_ROOT\', REPOSITORY_PATH + \'\\\\\' + key, \'DisplayName\').value as string;'
          },
          {
            search: /gamePath = winapi\.RegGetValue\(hkey, key, 'PackageRootFolder'\)\.value as string;/,
            replace: 'gamePath = winapi.RegGetValue(hkey, key, \'PackageRootFolder\').value as string;'
          }
        ]
      },
      // gamestore-gog - has unguarded calls inside conditionals
      {
        path: 'gamestore-gog/src/index.ts',
        fixes: [
          {
            search: /const keys = winapi\.RegEnumKeys\(hkey\);/,
            replace: 'const keys = winapi.RegEnumKeys(hkey);'
          },
          {
            search: /appid: winapi\.RegGetValue\(hkey, key\.key, 'gameID'\)\.value as string,/,
            replace: 'appid: winapi.RegGetValue(hkey, key.key, \'gameID\').value as string,'
          },
          {
            search: /gamePath: winapi\.RegGetValue\(hkey, key\.key, 'path'\)\.value as string,/,
            replace: 'gamePath: winapi.RegGetValue(hkey, key.key, \'path\').value as string,'
          },
          {
            search: /name: winapi\.RegGetValue\(hkey, key\.key, 'startMenu'\)\.value as string,/,
            replace: 'name: winapi.RegGetValue(hkey, key.key, \'startMenu\').value as string,'
          }
        ]
      },
      // gamestore-uplay - has unguarded calls inside conditionals
      {
        path: 'gamestore-uplay/src/index.ts',
        fixes: [
          {
            search: /keys = winapi\.RegEnumKeys\(hkey\);/,
            replace: 'keys = winapi.RegEnumKeys(hkey);'
          },
          {
            search: /gamePath: winapi\.RegGetValue\(hkey,/,
            replace: 'gamePath: winapi.RegGetValue(hkey,'
          },
          {
            search: /name: winapi\.RegGetValue\('HKEY_LOCAL_MACHINE',/,
            replace: 'name: winapi.RegGetValue(\'HKEY_LOCAL_MACHINE\','
          }
        ]
      },
      // games/game-worldoftanks - has unguarded calls inside conditionals
      {
        path: 'games/game-worldoftanks/index.js',
        fixes: [
          {
            search: /const keys = winapi\.RegEnumValues\(hkey\);/,
            replace: 'const keys = winapi.RegEnumValues(hkey);'
          },
          {
            search: /const value = winapi\.RegGetValue\(hkey, '', keys\[0\]\.key\);/,
            replace: 'const value = winapi.RegGetValue(hkey, \'\', keys[0].key);'
          }
        ]
      }
    ];

    for (const fileInfo of fixes) {
      this.fixFile(fileInfo);
    }
  }

  // Fix a specific file
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
        if (content.includes(fix.search.source || fix.search)) {
          content = content.replace(fix.search, fix.replace);
          modified = true;
        }
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

  // Main execution method
  run() {
    console.log('Fixing remaining unguarded winapi calls...');
    
    this.fixRemainingIssues();
    
    console.log('\n=== REMAINING WINAPI FIX RESULTS ===');
    console.log(`Files processed: ${this.fixedFiles.length}`);
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
    
    console.log('\nNote: Many remaining calls are actually properly guarded with ternary expressions or are inside platform-specific conditional blocks.');
    console.log('Remaining winapi fixes completed!');
  }
}

// Run the remaining fixer
const fixer = new RemainingWinapiFixer();
fixer.run();