#!/usr/bin/env node

/**
 * Git Repository Conversion Script
 * 
 * This script converts npm/yarn installed packages to proper Git repositories
 * so they can be managed with the repository management system.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the module configuration
const ModuleManager = require('./manage-node-modules.js');

class RepositoryConverter {
  constructor() {
    this.rootDir = process.cwd();
    this.manager = new ModuleManager();
  }

  /**
   * Execute a command in a specific directory
   */
  execInDir(dir, command, options = {}) {
    const fullPath = path.join(this.rootDir, dir);
    console.log(`[${path.basename(dir)}] Running: ${command}`);
    
    try {
      const result = execSync(command, {
        cwd: fullPath,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });
      return result;
    } catch (error) {
      console.error(`[${path.basename(dir)}] Error: ${error.message}`);
      if (!options.ignoreErrors) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Check if a directory exists
   */
  directoryExists(dirPath) {
    return fs.existsSync(path.join(this.rootDir, dirPath));
  }

  /**
   * Check if a directory is already a Git repository
   */
  isGitRepo(dirPath) {
    const fullPath = path.join(this.rootDir, dirPath);
    return fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, '.git'));
  }

  /**
   * Backup a directory before conversion
   */
  backupDirectory(dirPath) {
    const backupPath = `${dirPath}.backup.${Date.now()}`;
    console.log(`📦 Creating backup: ${backupPath}`);
    
    try {
      this.execInDir('.', `cp -r "${dirPath}" "${backupPath}"`, { ignoreErrors: true });
      return backupPath;
    } catch (error) {
      console.warn(`⚠️  Failed to create backup: ${error.message}`);
      return null;
    }
  }

  /**
   * Convert a single module to a Git repository
   */
  async convertModule(moduleName, config) {
    console.log(`\n🔄 Converting ${moduleName} to Git repository...`);

    if (!config.repository) {
      console.log(`📍 ${moduleName}: Local project, skipping conversion`);
      return { success: false, reason: 'local' };
    }

    if (!this.directoryExists(config.path)) {
      console.log(`❌ ${moduleName}: Directory not found at ${config.path}`);
      return { success: false, reason: 'not-found' };
    }

    if (this.isGitRepo(config.path)) {
      console.log(`✅ ${moduleName}: Already a Git repository`);
      return { success: true, reason: 'already-git' };
    }

    try {
      // Create backup
      const backupPath = this.backupDirectory(config.path);

      // Remove the existing directory
      console.log(`🗑️  Removing npm-installed version...`);
      this.execInDir('.', `rm -rf "${config.path}"`, { ignoreErrors: true });

      // Create parent directory if it doesn't exist
      const parentDir = path.dirname(config.path);
      if (!this.directoryExists(parentDir)) {
        console.log(`📁 Creating parent directory: ${parentDir}`);
        fs.mkdirSync(path.join(this.rootDir, parentDir), { recursive: true });
      }

      // Clone the Git repository
      console.log(`📥 Cloning from ${config.repository}...`);
      const cloneCommand = `git clone ${config.repository} "${path.basename(config.path)}"`;
      this.execInDir(parentDir, cloneCommand);

      // If there's a specific branch, check it out
      if (config.branch && config.branch !== 'master') {
        console.log(`🌿 Checking out branch: ${config.branch}`);
        this.execInDir(config.path, `git checkout ${config.branch}`, { ignoreErrors: true });
      }

      // Install dependencies if package.json exists
      const packageJsonPath = path.join(this.rootDir, config.path, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        console.log(`📦 Installing dependencies...`);
        this.execInDir(config.path, 'yarn install', { ignoreErrors: true });
      }

      // If there's a build process, run it
      const hasBinding = fs.existsSync(path.join(this.rootDir, config.path, 'binding.gyp'));
      if (hasBinding && config.type === 'cpp') {
        console.log(`🔨 Building native module...`);
        this.execInDir(config.path, 'yarn rebuild || yarn run prebuild || node-gyp rebuild', { ignoreErrors: true });
      }

      console.log(`✅ ${moduleName}: Successfully converted to Git repository`);
      
      // Clean up backup if conversion was successful
      if (backupPath) {
        this.execInDir('.', `rm -rf "${backupPath}"`, { ignoreErrors: true });
      }

      return { success: true, reason: 'converted' };

    } catch (error) {
      console.error(`❌ ${moduleName}: Conversion failed - ${error.message}`);
      return { success: false, reason: 'failed', error: error.message };
    }
  }

  /**
   * Convert all modules to Git repositories
   */
  async convertAllModules(filter = 'git') {
    console.log('🔄 Converting npm packages to Git repositories...\n');

    const modules = this.manager.getFilteredModules(filter);
    const results = {
      converted: [],
      alreadyGit: [],
      failed: [],
      skipped: []
    };

    for (const [moduleName, config] of modules) {
      const result = await this.convertModule(moduleName, config);
      
      switch (result.reason) {
        case 'converted':
          results.converted.push(moduleName);
          break;
        case 'already-git':
          results.alreadyGit.push(moduleName);
          break;
        case 'failed':
          results.failed.push({ name: moduleName, error: result.error });
          break;
        case 'local':
        case 'not-found':
          results.skipped.push({ name: moduleName, reason: result.reason });
          break;
      }
    }

    // Print summary
    console.log('\n📊 Conversion Summary:');
    console.log(`✅ Converted: ${results.converted.length}`);
    if (results.converted.length > 0) {
      results.converted.forEach(name => console.log(`   • ${name}`));
    }

    console.log(`📂 Already Git repos: ${results.alreadyGit.length}`);
    if (results.alreadyGit.length > 0) {
      results.alreadyGit.forEach(name => console.log(`   • ${name}`));
    }

    console.log(`⚠️  Skipped: ${results.skipped.length}`);
    if (results.skipped.length > 0) {
      results.skipped.forEach(item => console.log(`   • ${item.name} (${item.reason})`));
    }

    console.log(`❌ Failed: ${results.failed.length}`);
    if (results.failed.length > 0) {
      results.failed.forEach(item => console.log(`   • ${item.name}: ${item.error}`));
    }

    return results;
  }

  /**
   * Show what would be converted without actually doing it
   */
  async dryRun(filter = 'git') {
    console.log('🔍 Dry run - showing what would be converted...\n');

    const modules = this.manager.getFilteredModules(filter);

    for (const [moduleName, config] of modules) {
      if (!config.repository) {
        console.log(`📍 ${moduleName}: Local project (would skip)`);
        continue;
      }

      if (!this.directoryExists(config.path)) {
        console.log(`❌ ${moduleName}: Directory not found (would skip)`);
        continue;
      }

      if (this.isGitRepo(config.path)) {
        console.log(`✅ ${moduleName}: Already Git repository`);
        continue;
      }

      console.log(`🔄 ${moduleName}: Would convert from npm package to Git repo`);
      console.log(`   Path: ${config.path}`);
      console.log(`   Repository: ${config.repository}`);
      if (config.branch) {
        console.log(`   Branch: ${config.branch}`);
      }
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
🔄 Git Repository Converter

This tool converts npm/yarn installed packages to proper Git repositories
so they can be managed with the repository management system.

USAGE:
  node scripts/convert-to-git.js <command> [filter]

COMMANDS:
  convert [filter]    Convert packages to Git repositories
  dry-run [filter]    Show what would be converted without doing it
  help               Show this help message

FILTERS:
  all          All projects (default)
  git          Only Git repositories
  cpp          C++ projects only
  csharp       C# projects only
  nexus        Nexus-Mods repositories only
  third-party  Third-party libraries only

EXAMPLES:
  # Dry run to see what would be converted
  node scripts/convert-to-git.js dry-run

  # Convert all C++ projects
  node scripts/convert-to-git.js convert cpp

  # Convert all Nexus-Mods repositories
  node scripts/convert-to-git.js convert nexus

  # Convert all Git repositories
  node scripts/convert-to-git.js convert

IMPORTANT NOTES:
- This will remove npm-installed packages and replace them with Git clones
- Backups are created automatically before conversion
- Dependencies will be reinstalled after cloning
- Native modules will be rebuilt if needed
- This operation may take several minutes to complete

WORKFLOW:
1. Run dry-run first to see what will be converted
2. Run convert to perform the actual conversion
3. Use the repository management system normally after conversion
`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filter = args[1];

  const converter = new RepositoryConverter();

  switch (command) {
    case 'convert':
      await converter.convertAllModules(filter || 'git');
      break;
      
    case 'dry-run':
      await converter.dryRun(filter || 'git');
      break;
      
    case 'help':
    case '--help':
    case '-h':
      converter.showHelp();
      break;
      
    default:
      console.error('❌ Unknown command. Use "help" for usage information.');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RepositoryConverter;