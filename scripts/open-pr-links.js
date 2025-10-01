#!/usr/bin/env node

/**
 * Automatic PR Link Opener
 * 
 * This script automatically opens pull request creation links in your default browser
 * for all repositories that have changes on the specified branch.
 */

const { execSync } = require('child_process');
const { MODULE_CONFIG } = require('./manage-node-modules.js');
const path = require('path');
const fs = require('fs');

class PRLinkOpener {
  constructor() {
    this.rootDir = process.cwd();
  }

  /**
   * Check if a directory exists and is a Git repository
   */
  isGitRepo(modulePath) {
    const fullPath = path.join(this.rootDir, modulePath);
    return fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, '.git'));
  }

  /**
   * Execute a command in a specific directory
   */
  execInDir(dir, command, options = {}) {
    const fullPath = path.join(this.rootDir, dir);
    
    try {
      const result = execSync(command, {
        cwd: fullPath,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options
      });
      return result;
    } catch (error) {
      if (!options.ignoreErrors) {
        console.error(`[${dir}] Error: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Get filtered modules based on type
   */
  getFilteredModules(filter = null) {
    const entries = Object.entries(MODULE_CONFIG);
    
    if (!filter) return entries;
    
    const filters = Array.isArray(filter) ? filter : [filter];
    return entries.filter(([name, config]) => 
      filters.some(f => {
        if (f === 'git') return config.repository !== null;
        if (f === 'local') return config.type === 'local-csharp';
        if (f === 'csharp') return config.type === 'csharp' || config.type === 'local-csharp';
        if (f === 'cpp') return config.type === 'cpp';
        if (f === 'nexus') return config.repository && config.repository.includes('Nexus-Mods');
        if (f === 'third-party') return config.thirdParty === true;
        return config.type === f;
      })
    );
  }

  /**
   * Check if a repository has changes on the specified branch
   */
  hasChangesOnBranch(modulePath, branchName) {
    // Check if the branch exists locally
    const localBranches = this.execInDir(modulePath, 'git branch', { silent: true });
    if (!localBranches || !localBranches.includes(branchName)) {
      return false;
    }

    // Check if the branch exists on remote
    const remoteBranches = this.execInDir(modulePath, 'git branch -r', { silent: true });
    if (!remoteBranches || !remoteBranches.includes(`origin/${branchName}`)) {
      return false;
    }

    // Get the base branch (master or main)
    const baseBranch = 'master'; // Could also check for 'main'
    
    // Check if there are differences between the feature branch and base branch
    const diff = this.execInDir(modulePath, `git rev-list --count ${baseBranch}..origin/${branchName}`, { silent: true });
    
    return diff && parseInt(diff.trim()) > 0;
  }

  /**
   * Open URL in default browser
   */
  openUrl(url) {
    const platform = process.platform;
    let commands = [];

    if (platform === 'win32') {
      // Multiple approaches for Windows
      commands = [
        `cmd /c start "" "${url}"`,
        `powershell -Command "Start-Process '${url}'"`,
        `explorer "${url}"`
      ];
    } else if (platform === 'darwin') {
      commands = [`open "${url}"`];
    } else {
      commands = [`xdg-open "${url}"`];
    }

    // Try each command until one works
    for (const command of commands) {
      try {
        execSync(command, { stdio: 'ignore' });
        return true;
      } catch (error) {
        console.log(`   ⚠️  Command failed: ${command}`);
        continue;
      }
    }
    
    console.error(`   ❌ All attempts failed to open: ${url}`);
    console.error(`   🔗 Please manually open: ${url}`);
    return false;
  }

  /**
   * Open PR creation links for repositories with changes
   */
  openPRLinks(branchName, filter = 'git', options = {}) {
    console.log(`🔍 Checking for repositories with changes on branch: ${branchName}\n`);

    const modules = this.getFilteredModules(filter);
    const linksToOpen = [];
    const { dryRun = false, delay = 2000 } = options;

    for (const [moduleName, config] of modules) {
      if (!config.repository) {
        console.log(`📦 ${moduleName}: Local project (skipping)`);
        continue;
      }

      if (!this.isGitRepo(config.path)) {
        console.log(`📦 ${moduleName}: Not a Git repository ⚠️`);
        continue;
      }

      console.log(`📦 Checking ${moduleName}...`);
      
      if (this.hasChangesOnBranch(config.path, branchName)) {
        const repoUrl = config.repository.replace('.git', '');
        const baseBranch = config.branch || 'master';
        const prUrl = `${repoUrl}/compare/${baseBranch}...${branchName}?expand=1`;
        
        console.log(`   ✅ Has changes - will open PR link`);
        linksToOpen.push({ name: moduleName, url: prUrl });
      } else {
        console.log(`   ⚪ No changes detected`);
      }
    }

    if (linksToOpen.length === 0) {
      console.log(`\n⚠️  No repositories found with changes on branch '${branchName}'`);
      return;
    }

    console.log(`\n🚀 Found ${linksToOpen.length} repositories with changes:`);
    for (const { name, url } of linksToOpen) {
      console.log(`   📦 ${name}: ${url}`);
    }

    if (dryRun) {
      console.log(`\n🔍 Dry run mode - links not opened. Use --open to actually open them.`);
      return;
    }

    console.log(`\n🌐 Opening PR creation links in your default browser...`);
    
    // Open links with delay to prevent overwhelming the browser
    linksToOpen.forEach(({ name, url }, index) => {
      setTimeout(() => {
        console.log(`   🔗 Opening ${name}...`);
        this.openUrl(url);
      }, index * delay);
    });

    console.log(`\n✅ All PR creation links will be opened. You can now create the pull requests manually.`);
  }

  /**
   * Display help information
   */
  showHelp() {
    console.log(`
🔗 Automatic PR Link Opener

USAGE:
  node scripts/open-pr-links.js <branch-name> [filter] [options]

OPTIONS:
  --dry-run    Show what would be opened without actually opening links
  --open       Actually open the links (default behavior)
  --delay <ms> Delay between opening links in milliseconds (default: 2000)

FILTERS:
  all          All projects (default)
  git          Only Git repositories  
  cpp          C++ projects only
  csharp       C# projects only
  nexus        Nexus-Mods repositories only

EXAMPLES:
  # Open PR links for all repositories with changes (dry run)
  node scripts/open-pr-links.js vortex-integration-1759310854655 --dry-run

  # Open PR links for C++ repositories with changes
  node scripts/open-pr-links.js vortex-integration-1759310854655 cpp

  # Open PR links with custom delay
  node scripts/open-pr-links.js vortex-integration-1759310854655 git --delay 3000

WORKFLOW:
  1. Script checks each repository for changes on the specified branch
  2. Generates PR creation URLs for repositories with changes
  3. Opens each URL in your default browser with a delay
  4. You manually complete the PR creation in the browser tabs
`);
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const branchName = args[0];
  
  if (!branchName || branchName === 'help' || branchName === '--help' || branchName === '-h') {
    new PRLinkOpener().showHelp();
    return;
  }
  
  const filter = args.find(arg => !arg.startsWith('--')) && args[1] !== branchName ? args[1] : 'git';
  const dryRun = args.includes('--dry-run');
  const shouldOpen = args.includes('--open') || !dryRun;
  const delayIndex = args.indexOf('--delay');
  const delay = delayIndex !== -1 && args[delayIndex + 1] ? parseInt(args[delayIndex + 1]) : 2000;

  const opener = new PRLinkOpener();
  opener.openPRLinks(branchName, filter, { 
    dryRun: !shouldOpen, 
    delay 
  });
}

if (require.main === module) {
  main();
}

module.exports = PRLinkOpener;