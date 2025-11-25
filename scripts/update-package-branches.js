#!/usr/bin/env node

/**
 * Package.json Branch Updater Script
 * 
 * This script updates package.json files to use specific Git branches
 * for testing purposes, and can restore them back to original versions.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the module configuration from the same file
const moduleConfigPath = path.join(__dirname, 'manage-node-modules.js');
delete require.cache[require.resolve(moduleConfigPath)];
const ModuleManager = require(moduleConfigPath);

class PackageUpdater {
  constructor() {
    this.rootDir = process.cwd();
    this.manager = new ModuleManager();
    this.backupSuffix = '.branch-backup';
    
    // Access the MODULE_CONFIG from the exported object
    this.moduleConfig = ModuleManager.MODULE_CONFIG || {};
  }

  /**
   * Recursively find all package.json files in the workspace
   */
  findPackageJsonFiles() {
    const packageFiles = [];
    
    // Directories to exclude from search
    const excludeDirs = new Set([
      'node_modules',
      '.git',
      'out',
      'dist',
      'build',
      '.vscode',
      'coverage'
    ]);

    /**
     * Recursively scan directory for package.json files
     */
    const scanDirectory = (dirPath, relativePath = '') => {
      try {
        const entries = fs.readdirSync(path.join(this.rootDir, dirPath), { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Skip excluded directories
            if (excludeDirs.has(entry.name)) {
              continue;
            }
            
            const subDirPath = path.join(dirPath, entry.name);
            const relativeSubPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
            scanDirectory(subDirPath, relativeSubPath);
          } else if (entry.name === 'package.json') {
            const packagePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
            packageFiles.push(packagePath.replace(/\\/g, '/'));
          }
        }
      } catch (error) {
        // Skip directories we can't read
        console.warn(`⚠️  Could not scan directory: ${dirPath}`);
      }
    };

    // Start scanning from root
    scanDirectory('.');
    
    console.log(`🔍 Found ${packageFiles.length} package.json files:`);
    packageFiles.forEach(file => {
      console.log(`   📄 ${file}`);
    });
    console.log('');

    return packageFiles;
  }

  /**
   * Read and parse a package.json file
   */
  readPackageJson(filePath) {
    const fullPath = path.join(this.rootDir, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Write a package.json file with proper formatting
   */
  writePackageJson(filePath, packageData) {
    const fullPath = path.join(this.rootDir, filePath);
    const content = JSON.stringify(packageData, null, 2) + '\n';
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  /**
   * Create backup of package.json file
   */
  createBackup(filePath) {
    const fullPath = path.join(this.rootDir, filePath);
    const backupPath = fullPath + this.backupSuffix;
    
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(fullPath, backupPath);
      console.log(`📦 Created backup: ${filePath}${this.backupSuffix}`);
      return true;
    }
    return false;
  }

  /**
   * Restore package.json from backup
   */
  restoreFromBackup(filePath) {
    const fullPath = path.join(this.rootDir, filePath);
    const backupPath = fullPath + this.backupSuffix;
    
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, fullPath);
      fs.unlinkSync(backupPath);
      console.log(`🔄 Restored: ${filePath}`);
      return true;
    }
    return false;
  }

  /**
   * Get the dependency key name for a module
   */
  getDependencyKey(moduleName) {
    const keyMap = {
      'winapi-bindings': 'winapi-bindings',
      'bsatk': 'bsatk',
      'esptk': 'esptk',
      'loot': 'loot',
      'gamebryo-savegame': 'gamebryo-savegame',
      'bsdiff-node': 'bsdiff-node',
      'xxhash-addon': 'xxhash-addon'
    };
    return keyMap[moduleName] || moduleName;
  }

  /**
   * Generate Git URL for a specific branch
   */
  generateBranchUrl(config, branchName) {
    if (!config.repository) return null;
    
    const repoUrl = config.repository.replace('.git', '');
    return `${repoUrl}#${branchName}`;
  }

  /**
   * Check if a package.json contains any of our managed dependencies
   */
  packageContainsManagedDependencies(packageData) {
    const depSections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    const managedKeys = Object.keys(this.moduleConfig).map(name => this.getDependencyKey(name));
    
    for (const section of depSections) {
      if (packageData[section]) {
        for (const depKey of managedKeys) {
          if (packageData[section][depKey]) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Find and update dependencies in package.json
   */
  updatePackageForBranch(filePath, branchName, modules = null) {
    const packageData = this.readPackageJson(filePath);
    let changes = 0;
    const appliedChanges = [];

    // Filter modules to update
    const moduleEntries = modules ? 
      Object.entries(this.moduleConfig).filter(([name]) => modules.includes(name)) :
      Object.entries(this.moduleConfig);

    // Check all dependency sections
    const depSections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    
    for (const [moduleName, config] of moduleEntries) {
      if (!config.repository) continue;
      
      const depKey = this.getDependencyKey(moduleName);
      const newUrl = this.generateBranchUrl(config, branchName);
      
      for (const section of depSections) {
        if (packageData[section] && packageData[section][depKey]) {
          const oldValue = packageData[section][depKey];
          packageData[section][depKey] = newUrl;
          changes++;
          appliedChanges.push({
            file: filePath,
            section,
            key: depKey,
            oldValue,
            newValue: newUrl
          });
          break; // Only update first occurrence
        }
      }
    }

    if (changes > 0) {
      this.writePackageJson(filePath, packageData);
    }

    return { changes, appliedChanges };
  }

  /**
   * Update all package.json files to use a specific branch
   */
  updateAllPackagesForBranch(branchName, options = {}) {
    const { modules = null, createBackups = true } = options;
    
    console.log(`🔄 Updating package.json files to use branch: ${branchName}\n`);
    
    const allPackageFiles = this.findPackageJsonFiles();
    const relevantPackageFiles = [];
    
    // Filter to only files that contain our managed dependencies
    for (const filePath of allPackageFiles) {
      try {
        const packageData = this.readPackageJson(filePath);
        if (this.packageContainsManagedDependencies(packageData)) {
          relevantPackageFiles.push(filePath);
        }
      } catch (error) {
        console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
      }
    }
    
    console.log(`📋 Processing ${relevantPackageFiles.length} package.json files with managed dependencies:\n`);
    
    let totalChanges = 0;
    const allChanges = [];

    for (const filePath of relevantPackageFiles) {
      console.log(`📝 Processing: ${filePath}`);
      
      // Create backup if requested
      if (createBackups) {
        this.createBackup(filePath);
      }

      const result = this.updatePackageForBranch(filePath, branchName, modules);
      
      if (result.changes > 0) {
        console.log(`   ✅ Updated ${result.changes} dependencies`);
        totalChanges += result.changes;
        allChanges.push(...result.appliedChanges);
      } else {
        console.log(`   ℹ️  No matching dependencies found (or already up to date)`);
      }
    }

    console.log(`\n📊 Summary: Updated ${totalChanges} dependencies across ${relevantPackageFiles.length} files\n`);
    
    if (allChanges.length > 0) {
      console.log(`🔗 Changes made:`);
      allChanges.forEach(change => {
        console.log(`   ${change.file}: ${change.key}: ${change.oldValue} → ${change.newValue}`);
      });
      console.log('');
    }

    return { totalChanges, allChanges };
  }

  /**
   * Restore all package.json files from backups
   */
  restoreAllPackages() {
    console.log(`🔄 Restoring package.json files from backups...\n`);
    
    const allPackageFiles = this.findPackageJsonFiles();
    let restored = 0;
    const restoredFiles = [];

    for (const filePath of allPackageFiles) {
      if (this.restoreFromBackup(filePath)) {
        restored++;
        restoredFiles.push(filePath);
      }
    }

    if (restored > 0) {
      console.log(`\n✅ Restored ${restored} package.json files:`);
      restoredFiles.forEach(file => {
        console.log(`   📄 ${file}`);
      });
    } else {
      console.log(`\nℹ️  No backup files found to restore`);
    }

    return restored;
  }

  /**
   * Show current Git branches for all modules
   */
  showCurrentBranches(filter = 'git') {
    console.log('🌿 Current Git branches for modules:\n');

    const modules = this.manager.getFilteredModules(filter);

    for (const [moduleName, config] of modules) {
      if (!config.repository || !this.manager.isGitRepo(config.path)) {
        console.log(`📦 ${moduleName}: Not a Git repository`);
        continue;
      }

      try {
        const branch = this.manager.execInDir(config.path, 'git branch --show-current', { silent: true });
        const status = this.manager.execInDir(config.path, 'git status --porcelain', { silent: true });
        const hasChanges = status && status.trim() !== '';
        
        console.log(`📦 ${moduleName}: ${branch.trim()}${hasChanges ? ' (modified)' : ''}`);
      } catch (error) {
        console.log(`📦 ${moduleName}: Error reading branch`);
      }
    }
  }

  /**
   * Generate package.json update for specific modules and branch
   */
  generateBranchUpdate(branchName, moduleNames) {
    console.log(`🔧 Generating package.json updates for branch: ${branchName}\n`);

    const modules = Object.entries(this.moduleConfig)
      .filter(([name]) => !moduleNames || moduleNames.includes(name));

    const updates = {};
    const affectedFiles = [];

    for (const [moduleName, config] of modules) {
      if (!config.repository) continue;
      
      const depKey = this.getDependencyKey(moduleName);
      const branchUrl = this.generateBranchUrl(config, branchName);
      
      updates[depKey] = branchUrl;
    }

    console.log('📝 Suggested package.json updates:');
    console.log(JSON.stringify(updates, null, 2));
    
    // Show which files would be affected
    const allPackageFiles = this.findPackageJsonFiles();
    const managedKeys = Object.keys(updates);
    
    console.log('\n📋 Files that would be updated:\n');
    
    for (const filePath of allPackageFiles) {
      try {
        const packageData = this.readPackageJson(filePath);
        const foundDeps = [];
        
        const depSections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
        for (const section of depSections) {
          if (packageData[section]) {
            for (const depKey of managedKeys) {
              if (packageData[section][depKey]) {
                foundDeps.push({ section, key: depKey, oldValue: packageData[section][depKey], newValue: updates[depKey] });
              }
            }
          }
        }
        
        if (foundDeps.length > 0) {
          console.log(`📄 ${filePath}:`);
          for (const { section, key, oldValue, newValue } of foundDeps) {
            console.log(`   ${section}.${key}: ${oldValue} → ${newValue}`);
          }
          affectedFiles.push({ filePath, dependencies: foundDeps });
        }
      } catch (error) {
        console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
      }
    }
    
    if (affectedFiles.length === 0) {
      console.log('ℹ️  No package.json files would be affected by this update.');
    } else {
      console.log(`\n📊 Summary: ${affectedFiles.length} package.json files would be updated with ${Object.keys(updates).length} different dependencies.`);
    }
    
    console.log('');

    return { updates, affectedFiles };
  }

  /**
   * Reinstall dependencies after package.json changes
   */
  reinstallDependencies() {
    console.log('📦 Reinstalling dependencies...\n');
    
    try {
      execSync('yarn install', { 
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      console.log('\n✅ Dependencies reinstalled successfully');
    } catch (error) {
      console.error('\n❌ Failed to reinstall dependencies');
      throw error;
    }
  }

  /**
   * Scan and show which package.json files contain managed dependencies
   */
  scanPackageFiles() {
    console.log('🔍 Scanning workspace for package.json files with managed dependencies...\n');
    
    const allPackageFiles = this.findPackageJsonFiles();
    const relevantFiles = [];
    const managedDeps = new Set(Object.keys(this.moduleConfig).map(name => this.getDependencyKey(name)));
    
    for (const filePath of allPackageFiles) {
      try {
        const packageData = this.readPackageJson(filePath);
        const foundDeps = [];
        
        const depSections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
        for (const section of depSections) {
          if (packageData[section]) {
            for (const [depKey, version] of Object.entries(packageData[section])) {
              if (managedDeps.has(depKey)) {
                foundDeps.push({ section, key: depKey, version });
              }
            }
          }
        }
        
        if (foundDeps.length > 0) {
          relevantFiles.push({ filePath, dependencies: foundDeps });
        }
      } catch (error) {
        console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
      }
    }
    
    console.log(`📋 Found ${relevantFiles.length} package.json files with managed dependencies:\n`);
    
    for (const { filePath, dependencies } of relevantFiles) {
      console.log(`📄 ${filePath}:`);
      for (const { section, key, version } of dependencies) {
        console.log(`   ${section}.${key}: ${version}`);
      }
      console.log('');
    }
    
    if (relevantFiles.length === 0) {
      console.log('ℹ️  No package.json files found with managed dependencies.');
    }
    
    return relevantFiles;
  }
  showHelp() {
    console.log(`
🔧 Package.json Branch Updater

This tool updates package.json files to use specific Git branches for testing,
and can restore them back to original versions.

USAGE:
  node scripts/update-package-branches.js <command> [options]

COMMANDS:
  update <branch> [modules...]    Update package.json to use specific branch
  restore                         Restore package.json files from backups
  scan                           Scan workspace for package.json files with managed dependencies
  show-branches [filter]          Show current Git branches for modules
  generate <branch> [modules...]  Generate package.json updates (preview only)
  reinstall                       Reinstall dependencies after changes
  help                           Show this help message

OPTIONS:
  --no-backup                     Don't create backups when updating
  --no-install                    Don't reinstall dependencies after update

EXAMPLES:
  # Scan workspace to see which package.json files contain managed dependencies
  node scripts/update-package-branches.js scan

  # Update all dependencies to use 'feature-branch'
  node scripts/update-package-branches.js update feature-branch

  # Update only specific modules to use 'fix-headers' branch
  node scripts/update-package-branches.js update fix-headers bsatk esptk

  # Show what would be updated (preview only)
  node scripts/update-package-branches.js generate feature-branch

  # Show current branches for all modules
  node scripts/update-package-branches.js show-branches

  # Restore original package.json files
  node scripts/update-package-branches.js restore

  # Update and reinstall dependencies
  node scripts/update-package-branches.js update feature-branch
  node scripts/update-package-branches.js reinstall

WORKFLOW EXAMPLE:
  # 1. Create feature branches in repositories
  node scripts/manage-node-modules.js create-branch "my-feature" cpp

  # 2. Update package.json to use feature branches for testing
  node scripts/update-package-branches.js update my-feature

  # 3. Test your changes with the feature branches
  yarn start

  # 4. Restore original dependencies when done
  node scripts/update-package-branches.js restore

SAFETY FEATURES:
- Automatic backups created before changes
- Selective module updating
- Preview mode with generate command
- Easy restoration from backups
- Integration with repository management system

NOTE: After updating package.json, you may need to run 'yarn install' to
fetch the new branch versions. Use the 'reinstall' command for this.
`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Parse flags
  const flags = args.filter(arg => arg.startsWith('--'));
  const nonFlags = args.filter(arg => !arg.startsWith('--'));
  
  const options = {
    createBackups: !flags.includes('--no-backup'),
    reinstall: !flags.includes('--no-install')
  };

  const updater = new PackageUpdater();

  switch (command) {
    case 'update':
      if (!nonFlags[1]) {
        console.error('❌ Branch name required');
        process.exit(1);
      }
      const branchName = nonFlags[1];
      const modules = nonFlags.slice(2);
      
      await updater.updateAllPackagesForBranch(branchName, {
        modules: modules.length > 0 ? modules : null,
        createBackups: options.createBackups
      });
      
      if (options.reinstall) {
        await updater.reinstallDependencies();
      }
      break;
      
    case 'restore':
      await updater.restoreAllPackages();
      if (options.reinstall) {
        await updater.reinstallDependencies();
      }
      break;
      
    case 'scan':
      updater.scanPackageFiles();
      break;
      
    case 'show-branches':
      updater.showCurrentBranches(nonFlags[1] || 'git');
      break;
      
    case 'generate':
      if (!nonFlags[1]) {
        console.error('❌ Branch name required');
        process.exit(1);
      }
      updater.generateBranchUpdate(nonFlags[1], nonFlags.slice(2));
      break;
      
    case 'reinstall':
      await updater.reinstallDependencies();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      updater.showHelp();
      break;
      
    default:
      console.error('❌ Unknown command. Use "help" for usage information.');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PackageUpdater;