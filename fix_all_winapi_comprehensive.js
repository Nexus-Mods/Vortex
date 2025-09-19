const fs = require('fs');
const path = require('path');

// Comprehensive winapi fix script
class WinapiFixerComprehensive {
  constructor() {
    this.extensionsDir = path.join(__dirname, 'extensions');
    this.fixedFiles = [];
    this.errors = [];
    
    // Patterns for different types of winapi usage
    this.patterns = {
      // Direct winapi calls without guards
      directCall: /winapi\.[A-Za-z][A-Za-z0-9]*\s*\(/g,
      
      // Ternary expressions that need fixing
      ternaryWithWinapi: /(const\s+\w+\s*=\s*)\(isWindows\(\)\s*&&\s*winapi\)\s*\?\s*(winapi\.[^:]+)\s*:\s*null;/g,
      
      // Function calls inside try blocks that need guards
      tryBlockWinapi: /(try\s*\{[^}]*?)winapi\./g,
      
      // Registry operations that need platform guards
      registryOps: /winapi\.(RegGetValue|RegSetKeyValue|RegEnumKeys|RegEnumValues|WithRegOpen)/g,
      
      // Process and system operations
      systemOps: /winapi\.(GetProcessList|GetModuleList|GetVolumePathName|GetDiskFreeSpaceEx|SetForegroundWindow|GetProcessWindowList)/g
    };
  }

  // Check if file already has proper platform guards
  hasProperGuards(content, winapiCall) {
    const lines = content.split('\n');
    const callLineIndex = content.indexOf(winapiCall);
    const beforeCall = content.substring(0, callLineIndex);
    const lineNumber = beforeCall.split('\n').length - 1;
    
    // Check surrounding lines for platform guards
    for (let i = Math.max(0, lineNumber - 10); i <= Math.min(lines.length - 1, lineNumber + 5); i++) {
      const line = lines[i];
      if (line.includes('isWindows()') || line.includes('process.platform')) {
        return true;
      }
    }
    return false;
  }

  // Fix ternary expressions
  fixTernaryExpressions(content) {
    return content.replace(this.patterns.ternaryWithWinapi, (match, declaration, winapiCall) => {
      // Already properly formatted ternary
      return match;
    });
  }

  // Fix direct winapi calls by adding platform guards
  fixDirectCalls(content, filePath) {
    const lines = content.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const winapiMatches = line.match(this.patterns.directCall);
      
      if (winapiMatches) {
        // Check if this line already has proper guards
        const hasGuard = this.hasProperGuards(content, winapiMatches[0]);
        
        if (!hasGuard) {
          // Determine the type of fix needed based on context
          const indent = line.match(/^\s*/)[0];
          
          if (line.includes('const ') && line.includes('=')) {
            // Variable assignment - convert to ternary
            const varMatch = line.match(/(const\s+\w+\s*=\s*)(.*)/);
            if (varMatch) {
              const [, declaration, assignment] = varMatch;
              if (!assignment.includes('?')) {
                lines[i] = `${indent}${declaration}(isWindows() && winapi) ? ${assignment.trim()} : null;`;
                modified = true;
              }
            }
          } else if (line.trim().startsWith('winapi.')) {
            // Direct winapi call - wrap in platform guard
            const winapiCall = line.trim();
            lines[i] = `${indent}if (isWindows() && winapi) {`;
            lines.splice(i + 1, 0, `${indent}  ${winapiCall}`);
            lines.splice(i + 2, 0, `${indent}}`);
            modified = true;
            i += 2; // Skip the inserted lines
          }
        }
      }
    }
    
    return modified ? lines.join('\n') : content;
  }

  // Fix specific problematic patterns
  fixSpecificPatterns(content, filePath) {
    let fixed = content;
    
    // Fix feedback extension specific issue
    if (filePath.includes('feedback/src/index.tsx')) {
      fixed = fixed.replace(
        /const msxml = winapi\.GetModuleList\(null\)\.find\(mod => mod\.module\.match\(reMatch\)\);/,
        'const msxml = winapi.GetModuleList(null).find(mod => mod.module.match(reMatch));'
      );
    }
    
    // Fix gamestore extensions
    if (filePath.includes('gamestore-')) {
      // Ensure all registry operations are properly guarded
      fixed = this.wrapRegistryOperations(fixed);
    }
    
    // Fix modtype extensions
    if (filePath.includes('modtype-')) {
      fixed = this.fixModtypeExtensions(fixed);
    }
    
    // Fix game extensions
    if (filePath.includes('game-')) {
      fixed = this.fixGameExtensions(fixed);
    }
    
    return fixed;
  }

  // Wrap registry operations in platform guards
  wrapRegistryOperations(content) {
    const lines = content.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (this.patterns.registryOps.test(line) && !this.hasProperGuards(content, line)) {
        const indent = line.match(/^\s*/)[0];
        
        // Check if it's inside a function that already has platform guards
        let hasOuterGuard = false;
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          if (lines[j].includes('if (isWindows()') || lines[j].includes('if (!isWindows()')) {
            hasOuterGuard = true;
            break;
          }
        }
        
        if (!hasOuterGuard && line.trim().startsWith('winapi.')) {
          lines[i] = `${indent}if (isWindows() && winapi) {`;
          lines.splice(i + 1, 0, `${indent}  ${line.trim()}`);
          lines.splice(i + 2, 0, `${indent}}`);
          modified = true;
          i += 2;
        }
      }
    }
    
    return modified ? lines.join('\n') : content;
  }

  // Fix modtype extensions
  fixModtypeExtensions(content) {
    // Remove redundant platform checks inside already guarded functions
    return content.replace(
      /if \(isWindows\(\) && winapi\) \{\s*\n\s*(const \w+ = )?winapi\./g,
      (match, constDecl) => {
        return constDecl ? `${constDecl}winapi.` : 'winapi.';
      }
    );
  }

  // Fix game extensions
  fixGameExtensions(content) {
    // Ensure all instPath assignments use proper ternary format
    return content.replace(
      /const instPath = winapi\./g,
      'const instPath = (isWindows() && winapi) ? winapi.'
    );
  }

  // Add necessary imports
  addImports(content, filePath) {
    const needsIsWindows = content.includes('isWindows()') && !content.includes('import') && !content.includes('require');
    
    if (needsIsWindows && filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      // TypeScript file
      if (!content.includes("import { isWindows }")) {
        const importMatch = content.match(/^(import.*from.*['"];?\s*\n)*/m);
        if (importMatch) {
          const imports = importMatch[0] || '';
          const newImport = "import { isWindows } from 'vortex-api';\n";
          return content.replace(imports, imports + newImport);
        } else {
          return "import { isWindows } from 'vortex-api';\n\n" + content;
        }
      }
    } else if (filePath.endsWith('.js')) {
      // JavaScript file
      if (!content.includes("const { isWindows }")) {
        const requireMatch = content.match(/^(const.*require.*\n)*/m);
        if (requireMatch) {
          const requires = requireMatch[0] || '';
          const newRequire = "const { isWindows } = require('vortex-api');\n";
          return content.replace(requires, requires + newRequire);
        } else {
          return "const { isWindows } = require('vortex-api');\n\n" + content;
        }
      }
    }
    
    return content;
  }

  // Process a single file
  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      let fixed = content;
      
      // Apply all fixes
      fixed = this.fixTernaryExpressions(fixed);
      fixed = this.fixDirectCalls(fixed, filePath);
      fixed = this.fixSpecificPatterns(fixed, filePath);
      fixed = this.addImports(fixed, filePath);
      
      // Only write if content changed
      if (fixed !== content) {
        fs.writeFileSync(filePath, fixed, 'utf8');
        this.fixedFiles.push(filePath);
        console.log(`Fixed: ${path.relative(this.extensionsDir, filePath)}`);
      }
      
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      console.error(`Error processing ${filePath}: ${error.message}`);
    }
  }

  // Recursively find all relevant files
  findFiles(dir, extensions = ['.js', '.ts', '.tsx']) {
    const files = [];
    
    try {
      const entries = fs.readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.findFiles(fullPath, extensions));
        } else if (extensions.some(ext => entry.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}: ${error.message}`);
    }
    
    return files;
  }

  // Main execution method
  run() {
    console.log('Starting comprehensive winapi fixes...');
    
    const files = this.findFiles(this.extensionsDir);
    console.log(`Found ${files.length} files to process`);
    
    for (const file of files) {
      this.processFile(file);
    }
    
    console.log('\n=== COMPREHENSIVE WINAPI FIX RESULTS ===');
    console.log(`Files processed: ${files.length}`);
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
        console.log(`  - ${path.relative(this.extensionsDir, file)}: ${error}`);
      });
    }
    
    console.log('\nComprehensive winapi fixes completed!');
  }
}

// Run the fixer
const fixer = new WinapiFixerComprehensive();
fixer.run();