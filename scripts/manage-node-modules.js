#!/usr/bin/env node

/**
 * Node Module Git Repository Management Script
 *
 * This script helps manage the Git repositories for Node.js modules that are
 * included as Git dependencies in the Vortex project. It can:
 * - Set up proper Git remotes for each module
 * - Push changes back to their respective repositories
 * - Sync module changes with upstream repositories
 * - Create branches and pull requests for module updates
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

// Configuration for each Node module with its Git repository
const MODULE_CONFIG = {
  // Core .NET Projects
  dotnetprobe: {
    path: "tools/dotnetprobe",
    repository: null, // Local project, part of main Vortex repository
    sshRepository: null,
    description: ".NET probe utility for Vortex core",
    type: "local-csharp",
  },

  // FOMOD Installer C# Projects (all from same repository)
  "fomod-installer": {
    path: "node_modules/fomod-installer",
    repository: "https://github.com/Nexus-Mods/fomod-installer.git",
    sshRepository: "git@github.com:Nexus-Mods/fomod-installer.git",
    description: "FOMOD Installer .NET libraries",
    type: "csharp",
    branch: "master",
    projects: [
      "FomodInstaller.Interface/FomodInstaller.Interface.csproj",
      "ModInstaller/ModInstaller.csproj",
      "ModInstallerIPC/ModInstallerIPC.csproj",
      "Utils/Utils.csproj",
      "InstallScripting/Scripting/Scripting.csproj",
      "InstallScripting/XmlScript/XmlScript.csproj",
      "InstallScripting/CSharpScript/CSharpScript.csproj",
      "AntlrUtil/AntlrUtil.csproj",
    ],
  },

  // Native C++ Addon Projects
  "winapi-bindings": {
    path: "node_modules/winapi-bindings",
    repository: "https://github.com/Nexus-Mods/node-winapi-bindings.git",
    sshRepository: "git@github.com:Nexus-Mods/node-winapi-bindings.git",
    description: "Windows API bindings for Node.js",
    type: "cpp",
  },
  vortexmt: {
    path: "node_modules/vortexmt",
    repository: "https://github.com/Nexus-Mods/node-vortexmt.git",
    sshRepository: "git@github.com:Nexus-Mods/node-vortexmt.git",
    description: "Vortex Mod Manager Toolkit",
    type: "cpp",
  },

  // Gamebryo Extension C++ Projects
  bsatk: {
    path: "extensions/gamebryo-bsa-support/node_modules/bsatk",
    repository: "https://github.com/Nexus-Mods/node-bsatk.git",
    sshRepository: "git@github.com:Nexus-Mods/node-bsatk.git",
    description: "BSA (Bethesda Softworks Archive) toolkit",
    type: "cpp",
  },
  esptk: {
    path: "extensions/gamebryo-plugin-management/node_modules/esptk",
    repository: "https://github.com/Nexus-Mods/node-esptk.git",
    sshRepository: "git@github.com:Nexus-Mods/node-esptk.git",
    description: "ESP (Elder Scrolls Plugin) toolkit",
    type: "cpp",
  },
  loot: {
    path: "extensions/gamebryo-plugin-management/node_modules/loot",
    repository: "https://github.com/Nexus-Mods/node-loot.git",
    sshRepository: "git@github.com:Nexus-Mods/node-loot.git",
    description: "LOOT (Load Order Optimization Tool) bindings",
    type: "cpp",
  },
  "gamebryo-savegame": {
    path: "extensions/gamebryo-savegame-management/node_modules/gamebryo-savegame",
    repository: "https://github.com/Nexus-Mods/node-gamebryo-savegames.git",
    sshRepository: "git@github.com:Nexus-Mods/node-gamebryo-savegames.git",
    description: "Gamebryo savegame management library",
    type: "cpp",
  },
  "bsdiff-node": {
    path: "extensions/collections/node_modules/bsdiff-node",
    repository: "https://github.com/Nexus-Mods/bsdiff-node.git",
    sshRepository: "git@github.com:Nexus-Mods/bsdiff-node.git",
    description: "Binary diff/patch library for Node.js",
    type: "cpp",
  },
};

class ModuleManager {
  constructor() {
    this.rootDir = process.cwd();
    this.useSSH = false; // Set to true if you have SSH keys configured
  }

  /**
   * Execute a command in a specific directory
   */
  execInDir(dir, command, options = {}) {
    const fullPath = path.join(this.rootDir, dir);
    console.log(`[${dir}] Running: ${command}`);

    try {
      const result = execSync(command, {
        cwd: fullPath,
        encoding: "utf8",
        stdio: options.silent ? "pipe" : "inherit",
        ...options,
      });
      return result;
    } catch (error) {
      console.error(`[${dir}] Error: ${error.message}`);
      if (!options.ignoreErrors) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Check if a directory exists and is a Git repository
   */
  isGitRepo(modulePath) {
    const fullPath = path.join(this.rootDir, modulePath);
    return (
      fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, ".git"))
    );
  }

  /**
   * Check if a directory exists (for local projects)
   */
  isLocalProject(modulePath) {
    const fullPath = path.join(this.rootDir, modulePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Get filtered modules based on type
   */
  getFilteredModules(filter = null) {
    const entries = Object.entries(MODULE_CONFIG);

    if (!filter) return entries;

    const filters = Array.isArray(filter) ? filter : [filter];
    return entries.filter(([name, config]) =>
      filters.some((f) => {
        if (f === "git") return config.repository !== null;
        if (f === "local") return config.type === "local-csharp";
        if (f === "csharp")
          return config.type === "csharp" || config.type === "local-csharp";
        if (f === "cpp") return config.type === "cpp";
        if (f === "nexus")
          return config.repository && config.repository.includes("Nexus-Mods");
        if (f === "third-party") return config.thirdParty === true;
        return config.type === f;
      }),
    );
  }

  /**
   * Setup Git remotes for all modules
   */
  setupRemotes(filter = "git") {
    console.log("🔧 Setting up Git remotes for modules...\n");

    const modules = this.getFilteredModules(filter);

    for (const [moduleName, config] of modules) {
      if (!config.repository) {
        console.log(`📦 ${moduleName}: Local project (${config.description})`);
        continue;
      }

      if (!this.isGitRepo(config.path)) {
        console.log(
          `⚠️  ${moduleName}: Not a Git repository at ${config.path}`,
        );
        continue;
      }

      console.log(`📦 Setting up ${moduleName} (${config.description})`);

      // Get current remotes
      const remotes = this.execInDir(config.path, "git remote -v", {
        silent: true,
      });

      // Add or update origin remote
      const repoUrl = this.useSSH ? config.sshRepository : config.repository;

      if (remotes && remotes.includes("origin")) {
        this.execInDir(config.path, `git remote set-url origin ${repoUrl}`, {
          ignoreErrors: true,
        });
        console.log(`✅ Updated origin remote to ${repoUrl}`);
      } else {
        this.execInDir(config.path, `git remote add origin ${repoUrl}`, {
          ignoreErrors: true,
        });
        console.log(`✅ Added origin remote: ${repoUrl}`);
      }

      // Fetch from origin
      this.execInDir(config.path, "git fetch origin", { ignoreErrors: true });

      // Handle specific branch if specified
      if (config.branch) {
        console.log(`🌿 Setting up branch: ${config.branch}`);
        this.execInDir(
          config.path,
          `git checkout ${config.branch} || git checkout -b ${config.branch} origin/${config.branch}`,
          { ignoreErrors: true },
        );
      }

      console.log("");
    }
  }

  /**
   * Check status of all modules
   */
  checkStatus(filter = null) {
    console.log("📊 Checking status for all projects...\n");

    const modules = this.getFilteredModules(filter);

    // Group by type for better organization
    const grouped = {};
    for (const [moduleName, config] of modules) {
      const type = config.type || "unknown";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push([moduleName, config]);
    }

    for (const [type, moduleList] of Object.entries(grouped)) {
      console.log(`📁 ${type.toUpperCase()} Projects:`);

      for (const [moduleName, config] of moduleList) {
        if (config.type === "local-csharp") {
          if (this.isLocalProject(config.path)) {
            console.log(`📦 ${moduleName}: Local C# project ✅`);
          } else {
            console.log(`📦 ${moduleName}: Local project not found ❌`);
          }
          continue;
        }

        if (!this.isGitRepo(config.path)) {
          console.log(`📦 ${moduleName}: Not a Git repository ⚠️`);
          continue;
        }

        console.log(`📦 ${moduleName} (${config.description}):`);

        // Show current branch and status
        const branch = this.execInDir(
          config.path,
          "git branch --show-current",
          { silent: true },
        );
        if (branch) {
          console.log(`   Branch: ${branch.trim()}`);
        }

        const status = this.execInDir(config.path, "git status --porcelain", {
          silent: true,
        });
        if (status && status.trim()) {
          console.log(
            `   Changes: ${status.split("\n").length} modified files`,
          );
        } else {
          console.log(`   Status: Clean`);
        }

        // Show recent commits
        this.execInDir(config.path, "git log --oneline -3", { silent: false });
      }
      console.log("");
    }
  }

  /**
   * Create a feature branch for changes
   */
  createBranch(branchName, filter = "git") {
    console.log(`🌿 Creating branch '${branchName}' for modules...\n`);

    const modules = this.getFilteredModules(filter);

    for (const [moduleName, config] of modules) {
      if (!config.repository) {
        console.log(
          `📦 ${moduleName}: Local project (skipping branch creation)`,
        );
        continue;
      }

      if (!this.isGitRepo(config.path)) {
        console.log(`⚠️  ${moduleName}: Not a Git repository`);
        continue;
      }

      console.log(`📦 Creating branch in ${moduleName}`);

      // Ensure we're on main/master branch or specified branch
      const defaultBranch = config.branch || "master";
      this.execInDir(config.path, `git checkout ${defaultBranch}`, {
        ignoreErrors: true,
      });
      if (defaultBranch === "master") {
        this.execInDir(config.path, "git checkout main", {
          ignoreErrors: true,
        });
      }

      // Pull latest changes
      this.execInDir(config.path, `git pull origin ${defaultBranch}`, {
        ignoreErrors: true,
      });
      if (defaultBranch === "master") {
        this.execInDir(config.path, "git pull origin main", {
          ignoreErrors: true,
        });
      }

      // Create and checkout new branch
      this.execInDir(config.path, `git checkout -b ${branchName}`, {
        ignoreErrors: true,
      });
      console.log(`✅ Created branch '${branchName}'`);
      console.log("");
    }
  }

  /**
   * Delete a branch from modules
   */
  deleteBranch(branchName, filter = "git", options = {}) {
    console.log(`🗑️  Deleting branch '${branchName}' from modules...\n`);

    const modules = this.getFilteredModules(filter);
    const { force = false, deleteRemote = false } = options;

    for (const [moduleName, config] of modules) {
      if (!config.repository) {
        console.log(
          `📦 ${moduleName}: Local project (skipping branch deletion)`,
        );
        continue;
      }

      if (!this.isGitRepo(config.path)) {
        console.log(`⚠️  ${moduleName}: Not a Git repository`);
        continue;
      }

      console.log(`📦 Deleting branch from ${moduleName}`);

      // Check if branch exists
      const branches = this.execInDir(config.path, "git branch", {
        silent: true,
      });
      if (!branches || !branches.includes(branchName)) {
        console.log(`   ⚠️  Branch '${branchName}' does not exist locally`);

        // Check if it exists on remote
        if (deleteRemote) {
          const remoteBranches = this.execInDir(config.path, "git branch -r", {
            silent: true,
          });
          if (
            remoteBranches &&
            remoteBranches.includes(`origin/${branchName}`)
          ) {
            console.log(`   🌐 Deleting remote branch 'origin/${branchName}'`);
            this.execInDir(
              config.path,
              `git push origin --delete ${branchName}`,
              { ignoreErrors: true },
            );
            console.log(`   ✅ Deleted remote branch`);
          } else {
            console.log(
              `   ⚠️  Remote branch 'origin/${branchName}' does not exist`,
            );
          }
        }
        continue;
      }

      // Check if we're currently on the branch we want to delete
      const currentBranch = this.execInDir(
        config.path,
        "git branch --show-current",
        { silent: true },
      );
      if (currentBranch && currentBranch.trim() === branchName) {
        console.log(
          `   🔄 Currently on branch '${branchName}', switching to default branch`,
        );
        const defaultBranch = config.branch || "master";
        this.execInDir(config.path, `git checkout ${defaultBranch}`, {
          ignoreErrors: true,
        });
        if (defaultBranch === "master") {
          this.execInDir(config.path, "git checkout main", {
            ignoreErrors: true,
          });
        }
      }

      // Delete local branch
      const deleteFlag = force ? "-D" : "-d";
      try {
        this.execInDir(config.path, `git branch ${deleteFlag} ${branchName}`, {
          ignoreErrors: false,
        });
        console.log(`   ✅ Deleted local branch '${branchName}'`);

        // Delete remote branch if requested
        if (deleteRemote) {
          console.log(`   🌐 Deleting remote branch 'origin/${branchName}'`);
          this.execInDir(
            config.path,
            `git push origin --delete ${branchName}`,
            { ignoreErrors: true },
          );
          console.log(`   ✅ Deleted remote branch`);
        }
      } catch (error) {
        console.log(
          `   ❌ Failed to delete local branch (use --force if branch has unmerged changes)`,
        );
      }
      console.log("");
    }
  }

  /**
   * Commit changes to all modules with modified files
   */
  commitChanges(message, filter = "git") {
    console.log(`💾 Committing changes with message: "${message}"\n`);

    const modules = this.getFilteredModules(filter);

    for (const [moduleName, config] of modules) {
      if (!config.repository) {
        console.log(`📦 ${moduleName}: Local project (skipping Git commit)`);
        continue;
      }

      if (!this.isGitRepo(config.path)) {
        console.log(`⚠️  ${moduleName}: Not a Git repository`);
        continue;
      }

      // Check if there are any changes
      const status = this.execInDir(config.path, "git status --porcelain", {
        silent: true,
      });

      if (!status || status.trim() === "") {
        console.log(`📦 ${moduleName}: No changes to commit`);
        continue;
      }

      console.log(`📦 Committing changes in ${moduleName}`);

      // Add all changes
      this.execInDir(config.path, "git add .");

      // Commit changes
      this.execInDir(config.path, `git commit -m "${message}"`);
      console.log(`✅ Committed changes`);
      console.log("");
    }
  }

  /**
   * Push changes to remote repositories
   */
  pushChanges(branchName = null, filter = "git") {
    console.log(`🚀 Pushing changes to remote repositories...\n`);

    const modules = this.getFilteredModules(filter);

    for (const [moduleName, config] of modules) {
      if (!config.repository) {
        console.log(`📦 ${moduleName}: Local project (skipping push)`);
        continue;
      }

      if (!this.isGitRepo(config.path)) {
        console.log(`⚠️  ${moduleName}: Not a Git repository`);
        continue;
      }

      console.log(`📦 Pushing ${moduleName}`);

      // Get current branch if not specified
      if (!branchName) {
        const currentBranch = this.execInDir(
          config.path,
          "git branch --show-current",
          { silent: true },
        );
        branchName = currentBranch
          ? currentBranch.trim()
          : config.branch || "master";
      }

      // Push to origin
      this.execInDir(config.path, `git push origin ${branchName}`, {
        ignoreErrors: true,
      });
      console.log(`✅ Pushed to origin/${branchName}`);
      console.log("");
    }
  }

  /**
   * Generate PR creation links for all modules with changes
   */
  generatePRLinks(branchName, filter = "git") {
    console.log(`🔗 Pull Request creation links:\n`);

    const modules = this.getFilteredModules(filter);

    for (const [moduleName, config] of modules) {
      if (!config.repository || !this.isGitRepo(config.path)) continue;

      const repoUrl = config.repository.replace(".git", "");
      const baseBranch = config.branch || "master";
      const prUrl = `${repoUrl}/compare/${baseBranch}...${branchName}?expand=1`;

      console.log(`📦 ${moduleName}:`);
      console.log(`   ${prUrl}`);
      console.log("");
    }
  }

  /**
   * Show project summary
   */
  showSummary() {
    console.log("📋 Vortex Project Summary\n");

    const modules = Object.entries(MODULE_CONFIG);
    const stats = {
      total: modules.length,
      csharp: 0,
      cpp: 0,
      local: 0,
      git: 0,
      nexus: 0,
      thirdParty: 0,
    };

    // Count by type
    for (const [name, config] of modules) {
      if (config.type === "csharp" || config.type === "local-csharp")
        stats.csharp++;
      if (config.type === "cpp") stats.cpp++;
      if (config.type === "local-csharp") stats.local++;
      if (config.repository) stats.git++;
      if (config.repository && config.repository.includes("Nexus-Mods"))
        stats.nexus++;
      if (config.thirdParty) stats.thirdParty++;
    }

    console.log(`📊 Statistics:`);
    console.log(`   Total Projects: ${stats.total}`);
    console.log(`   C# Projects: ${stats.csharp}`);
    console.log(`   C++ Projects: ${stats.cpp}`);
    console.log(`   Local Projects: ${stats.local}`);
    console.log(`   Git Repositories: ${stats.git}`);
    console.log(`   Nexus-Mods Repositories: ${stats.nexus}`);
    console.log(`   Third-party Libraries: ${stats.thirdParty}\n`);

    // Group and display by type
    const grouped = {};
    for (const [moduleName, config] of modules) {
      const type = config.type || "unknown";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push([moduleName, config]);
    }

    for (const [type, moduleList] of Object.entries(grouped)) {
      console.log(`📁 ${type.toUpperCase()} Projects:`);
      for (const [name, config] of moduleList) {
        const status = config.repository ? "🔗" : "📍";
        const third = config.thirdParty ? " (3rd party)" : "";
        console.log(`   ${status} ${name} - ${config.description}${third}`);
      }
      console.log("");
    }
  }

  /**
   * Display help information
   */
  showHelp() {
    console.log(`
🛠️  Vortex Project Repository Manager

USAGE:
  node scripts/manage-node-modules.js <command> [options]

COMMANDS:
  setup-remotes [filter]         Set up Git remotes for modules
  status [filter]                Check status for modules  
  summary                        Show project summary and statistics
  create-branch <name> [filter]  Create a new branch in modules
  delete-branch <name> [filter] [--force] [--remote]  Delete a branch from modules
  commit "<message>" [filter]    Commit changes in modules
  push [branch] [filter]         Push changes to remote repositories
  pr-links <branch> [filter]     Generate pull request creation links
  workflow "<message>" [filter]  Complete workflow: create branch, commit, push, and show PR links

FILTERS:
  all          All projects (default)
  git          Only Git repositories
  local        Only local projects
  csharp       C# projects (.NET/FOMOD)
  cpp          C++ projects (native addons)
  nexus        Nexus-Mods repositories only
  third-party  Third-party libraries

EXAMPLES:
  # Setup remotes for all Git repositories
  node scripts/manage-node-modules.js setup-remotes

  # Check status of C++ projects only
  node scripts/manage-node-modules.js status cpp

  # Show project summary
  node scripts/manage-node-modules.js summary

  # Create branch for Nexus-Mods repositories only
  node scripts/manage-node-modules.js create-branch "fix-header-files" nexus

  # Delete branch from C++ projects (safe delete)
  node scripts/manage-node-modules.js delete-branch "old-feature" cpp

  # Force delete branch and remove from remote
  node scripts/manage-node-modules.js delete-branch "experimental-branch" git --force --remote

  # Complete workflow for C++ projects
  node scripts/manage-node-modules.js workflow "Add missing header files to Visual Studio projects" cpp

  # Commit changes to specific project types
  node scripts/manage-node-modules.js commit "Update build configuration" csharp

PROJECT TYPES MANAGED:
• Core .NET Projects:
  - dotnetprobe (Local C# project)

• FOMOD Installer (.NET):
  - fomod-installer (8 C# projects from Nexus-Mods/fomod-installer)

• Native C++ Addons:
  - winapi-bindings (Windows API bindings)
  - xxhash-addon (Hash algorithm - 3rd party)

• Gamebryo Extension C++ Projects:
  - bsatk (BSA archive toolkit)
  - esptk (ESP plugin toolkit)  
  - loot (Load order optimization)
  - gamebryo-savegame (Savegame management)
  - bsdiff-node (Binary diff/patch)

WORKFLOW INTEGRATION:
These tools integrate seamlessly with the Visual Studio solution (vortex.sln).
Changes to .vcxproj files, source code, and configurations can be managed
and pushed back to their respective repositories.
`);
  }

  /**
   * Complete workflow: create branch, commit, push, and generate PR links
   */
  workflow(message, filter = "git") {
    const branchName = `vortex-integration-${Date.now()}`;

    console.log(`🔄 Starting complete workflow with branch: ${branchName}`);
    if (filter !== "git") {
      console.log(`🔍 Filter: ${filter} projects only`);
    }
    console.log("");

    this.createBranch(branchName, filter);
    this.commitChanges(message, filter);
    this.pushChanges(branchName, filter);
    this.generatePRLinks(branchName, filter);

    console.log(
      `✅ Workflow complete! Don't forget to create pull requests using the links above.`,
    );
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param1 = args[1];
  const param2 = args[2];

  const manager = new ModuleManager();

  switch (command) {
    case "setup-remotes":
      manager.setupRemotes(param1 || "git");
      break;

    case "status":
      manager.checkStatus(param1);
      break;

    case "summary":
      manager.showSummary();
      break;

    case "create-branch":
      if (!param1) {
        console.error("❌ Branch name required");
        process.exit(1);
      }
      manager.createBranch(param1, param2 || "git");
      break;

    case "delete-branch":
      if (!param1) {
        console.error("❌ Branch name required");
        process.exit(1);
      }
      const options = {
        force: args.includes("--force"),
        deleteRemote: args.includes("--remote"),
      };
      manager.deleteBranch(param1, param2 || "git", options);
      break;

    case "commit":
      if (!param1) {
        console.error("❌ Commit message required");
        process.exit(1);
      }
      manager.commitChanges(param1, param2 || "git");
      break;

    case "push":
      manager.pushChanges(param1, param2 || "git");
      break;

    case "pr-links":
      if (!param1) {
        console.error("❌ Branch name required");
        process.exit(1);
      }
      manager.generatePRLinks(param1, param2 || "git");
      break;

    case "workflow":
      if (!param1) {
        console.error("❌ Commit message required");
        process.exit(1);
      }
      manager.workflow(param1, param2 || "git");
      break;

    case "help":
    case "--help":
    case "-h":
      manager.showHelp();
      break;

    default:
      console.error('❌ Unknown command. Use "help" for usage information.');
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ModuleManager;
module.exports.MODULE_CONFIG = MODULE_CONFIG;
