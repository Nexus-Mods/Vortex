<p align="center">
  <img src=".github/assets/github_readme_title.png" alt="Vortex Mod Manager"/>
</p>

<p align="center">
  <img src="https://img.shields.io/github/last-commit/Nexus-Mods/Vortex" alt="Last Commit"/>
  <img src="https://img.shields.io/github/actions/workflow/status/Nexus-Mods/Vortex/main.yml" alt="Build Status"/>
  <img src="https://img.shields.io/github/v/release/Nexus-Mods/Vortex?logo=github" alt="Release"/>
  <img src="https://img.shields.io/github/v/release/Nexus-Mods/Vortex?include_prereleases&label=pre-release&logo=github" alt="Pre-release"/>
  <img src="https://img.shields.io/github/contributors/Nexus-Mods/Vortex" alt="Contributors"/>
  <img src="https://img.shields.io/github/forks/Nexus-Mods/Vortex?style=flat&logo=github" alt="Forks"/>
  <img src="https://img.shields.io/github/stars/Nexus-Mods/Vortex?style=flat&logo=github" alt="Stars"/>
  <img src="https://img.shields.io/github/watchers/Nexus-Mods/Vortex?style=flat&logo=github" alt="Watchers"/>
  <img src="https://img.shields.io/github/license/Nexus-Mods/Vortex" alt="License"/>
</p>

<p align="center">  
<a href="https://discord.gg/nexusmods"><img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord"></a>
<a href="https://twitter.com/nexussites"><img src="https://img.shields.io/badge/twitter-000000?style=for-the-badge&logo=x&logoColor=white" alt="X (formally Twitter)"></a>
<a href="https://www.youtube.com/c/NexusModsYT"><img src="https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="YouTube"></a>
<a href="https://www.instagram.com/nexusmodsofficial/"><img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
<a href="https://www.reddit.com/r/nexusmods/"><img src="https://img.shields.io/badge/Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white" alt="Reddit"></a>
<a href="https://www.facebook.com/nexussites/"><img src="https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white" alt="Facebook"></a>
</p>

## Introduction

Vortex is the current mod manager from Nexus Mods. It is designed to make modding your game as simple as possible for new users, while still providing enough control for more experienced veterans of the modding scene.

Our approach with Vortex aims to take complex tasks such as sorting your load order or managing your mod files and automates as much of the process as possible with the goal of having you achieve a stable modded game with minimal effort. We want to help you spend less time modding and more time playing your games.

## Features

* **Multi-game Support** - with mod support for over 250 different games and counting, Vortex is the most versatile mod manager available. This includes games such as [Skyrim](https://www.nexusmods.com/skyrimspecialedition), [Fallout 3](https://www.nexusmods.com/fallout3), [Fallout 4](https://www.nexusmods.com/fallout4), [Fallout: New Vegas](https://www.nexusmods.com/newvegas/), [Cyberpunk 2077](https://www.nexusmods.com/cyberpunk2077/), [Baldur's Gate 3](https://www.nexusmods.com/baldursgate3/), [Starfield](https://www.nexusmods.com/starfield/), [Stardew Valley](https://www.nexusmods.com/stardewvalley/), [Bannerlord](https://www.nexusmods.com/mountandblade2bannerlord), [Witcher 3](https://www.nexusmods.com/witcher3), [Elden Ring](https://www.nexusmods.com/eldenring), [The Sims 4](https://www.nexusmods.com/thesims4), [Monster Hunter: World](https://www.nexusmods.com/monsterhunterworld), [Oblivion](https://www.nexusmods.com/oblivion), [Palworld](https://www.nexusmods.com/palworld), [Blade & Sorcery](https://www.nexusmods.com/bladeandsorcery), [Valheim](https://www.nexusmods.com/valheim), [Hogwarts Legacy](https://www.nexusmods.com/hogwartslegacy/), [7 Days to Die](https://www.nexusmods.com/7daystodie/). 

* **Close integration with Nexus Mods** - Vortex is designed to seamlessly interact with Nexus Mods allowing you to easily find, install, and play mods from our site, learn about new files and catch the latest news.

* **Modding made easy** - The built-in auto-sorting system manages your load order and helps you to resolve mod conflicts with powerful, yet easy to use plugin management features.

* **Mod Profiles** - Easily set up, switch between, and manage independent mod profiles enabling you to use exactly the combination of mods that you want for a particular playthrough.

* **Modern, Easy-to-use UI** - Featuring a fully customisable interface, Vortex allows you to quickly and easily access tools and manage your games, plugins, downloads and save games.

* **Extensions and Plugins** - Vortex is released under a GPL-3 License giving our community the ability to write extensions and frameworks which can then interact with Vortex, continually adding to its functionality.

## Getting Started

To get started, Vortex can be downloaded from [Nexus Mods](https://www.nexusmods.com/site/mods/1?tab=files) or from [GitHub](https://github.com/Nexus-Mods/Vortex/releases/latest). After the installer has been downloaded, just run it and follow the instructions.

Additional information on Vortex and guides can be found in the [Vortex Wiki](https://github.com/Nexus-Mods/Vortex/wiki).

## Development

The `windows-dev-setup.ps1` PowerShell script automatically sets up a complete Windows development environment for building the [Vortex](https://github.com/Nexus-Mods/Vortex) project. It installs all required tools and dependencies, then clones and prepares the repository.

### What This Script Does

The script installs and configures the following development tools:

- **Git** - Version control system
- **Python 3.10** - Required for native module compilation  
- **CMake** - Build system generator
- **Visual Studio 2022 Build Tools** - C++ compiler and Windows SDK
- **NVM for Windows** - Node.js version manager
- **Node.js 18.20.4** - JavaScript runtime (via NVM)
- **Yarn 1.x** - Package manager for Node.js
- **Repository Setup** - Clones Vortex repo to `C:\vortex\Vortex`

### Prerequisites

- Windows 10/11
- PowerShell 5.1 or later
- Administrator privileges
- **winget** (App Installer from Microsoft Store)

### How to Use

1. **Download the script** (`windows_dev_setup.ps1`)

2. **Open PowerShell as Administrator**
   - Press `Win + X`, then press `A`
   - Or right-click Start button → "Windows PowerShell (Admin)"

3. **Allow script execution** (if needed):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   ```

4. **Run the script**:
   ```powershell
   .\windows_dev_setup.ps1
   ```

5. **Wait for completion** - The script will show colored progress logs

6. **Start developing**:
   ```powershell
   cd C:\vortex\Vortex
   yarn install
   ```

### Smart Installation Logic

The script intelligently handles existing installations:

- **Fresh Install**: Uses winget for new installations
- **Existing Tools**: Detects and updates/modifies existing installations
- **Visual Studio Build Tools**: Uses `vswhere` to detect existing installations and only adds missing components
- **NVM**: Repairs broken configurations and activates Node.js 18.20.4

### Common Issues & Solutions

#### 1. "winget not found" Error

**Problem**: App Installer is not installed or outdated

**Solution**: 
- Install "App Installer" from Microsoft Store
- Or download from: https://aka.ms/getwinget

#### 2. Script Execution Policy Blocked

**Problem**: PowerShell blocks unsigned scripts

**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

#### 3. Visual Studio Build Tools Installation Hangs

**Problem**: VS installer UI appears or process hangs

**Solution**:
- Close any open VS installer windows
- Restart PowerShell as Administrator
- Run script again (it will detect and modify existing installation)

#### 4. NVM "settings.txt" Errors

**Problem**: NVM configuration is corrupted or missing

**Solution**: The script automatically repairs NVM settings, but if issues persist:
```powershell
# Manual fix
Remove-Item "$env:APPDATA\nvm\settings.txt" -Force
# Re-run the script
```

#### 5. Node.js Version Mismatch

**Problem**: Wrong Node.js version active after installation

**Solution**:
```powershell
nvm use 18.20.4
# Or manually:
nvm list
nvm use [correct-version]
```

#### 6. Path Issues / Commands Not Found

**Problem**: Newly installed tools not in PATH

**Solution**: 
- Restart PowerShell completely
- Or manually refresh environment:
```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
```

#### 7. node-gyp Compilation Failures

**Problem**: Native modules fail to build

**Solution**: The script configures this automatically, but if issues persist:
```powershell
npm config set msvs_version 2022
npm config set python python3.10
```

#### 8. Git Clone Failures

**Problem**: Network issues or authentication problems

**Solution**:
- Check internet connection
- For private repos, set up SSH keys or personal access tokens
- Re-run script (it will update existing clone)

#### 9. Permission Denied Errors

**Problem**: Insufficient privileges

**Solution**:
- Ensure PowerShell is running as Administrator
- Check Windows Defender isn't blocking installations
- Temporarily disable antivirus if needed

#### 10. Disk Space Issues

**Problem**: Insufficient disk space for installations

**Solution**:
- Free up at least 5GB of disk space
- Visual Studio Build Tools alone requires ~3GB

### What Gets Installed Where

- **Git**: `C:\Program Files\Git`
- **Python 3.10**: `C:\Users\[User]\AppData\Local\Programs\Python\Python310`
- **CMake**: `C:\Program Files\CMake`
- **VS Build Tools**: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`
- **NVM**: `%APPDATA%\nvm` or `C:\Program Files\nvm`
- **Node.js**: `C:\Program Files\nodejs` (symlink managed by NVM)
- **Repository**: `C:\vortex\Vortex`

### Configuration Files Created

- **`.npmrc`** (user home): Configures node-gyp for VS 2022
- **`.npmrc`** (project): Sets MSVS version for project builds
- **NVM settings.txt**: Configures NVM paths and architecture

### Troubleshooting Tips

1. **Check the logs**: The script provides colored output showing what's happening
2. **Run twice**: Some installations may need a second attempt
3. **Restart PowerShell**: Fresh session can resolve PATH issues  
4. **Check versions**: Run the script again to see version info
5. **Manual verification**: Use `winget list` to see what's actually installed

### Re-running the Script

The script is designed to be re-run safely. It will:
- Skip already-installed tools
- Update/repair existing installations
- Only install missing components

### After Installation

Once complete, you can build Vortex:

```powershell
cd C:\vortex\Vortex
yarn install          # Install dependencies
yarn build            # Build the application
```

### Support

If issues persist after trying these solutions:
1. Check the [Vortex repository](https://github.com/Nexus-Mods/Vortex) for specific build instructions
2. Ensure your Windows system is up to date
3. Try running individual installation commands manually to isolate the problem

## Development Decisions

The following section aims to clarify and explain a few development decisions.

### Development vs Release builds

The toolchain for development builds and release builds is quite different.

In dev builds, the typescript compiler (tsc) is used directly to transliterate each `.ts` file to `.js` individually, electron runs those files directly, dependencies are loaded from `node_modules`.

In release builds we use webpack and ts-loader to bake all `.ts` files and dependencies into two javascript files (one for the main/browser process, one for the renderer). `electron-builder` is used to bundle code & assets, generate an nsis installer, build it into an exe installer and sign them (and all the executables and dlls we ship). There are mulitple electron-builder configuration files for multiple variants, only "oneclick" and "advanced" are used for release builds, the others may be in different states of disrepair (though ci should work as well)

As a result, dev builds are easier to work with and building is much quicker but runtime is slower.

Further, we use a two-package structure, meaning the `/package.json` file is used for all development and the build environment for releases (e.g. this file always controls the electron version being used/bundled) whereas `/app/package.json` decides settings (name, version, dependencies) for the release builds only. We use a custom script (`checkPackages.js`) to ensure that the dependencies for release are a subset of the build `env` dependencies and that they use the same version to avoid problems that didn't occur during testing because of differing dependencies.

Bundled extensions on the other hand are built the same between dev and release: they are always built with webpack and each have their own build setup - with the exception of simple game extensions which are already single js files, those simply get copied over.

### Yarn 1 vs Yarn 3 vs NPM vs PNPM

This codebase still use yarn 1 (classic). Any attempt to use yarn 2 or 3 ended up with nonsensical errors (missing dependencies that are clearly listed, successive installs leading to missing packages) with no reasonable way to investigate why. npm and pnpm are quite slow in comparison. We don't really use any yarn-specific features (workspaces?) so switching shouldn't be too difficult but for now yarn "classic" works.

### ESM vs CommonJS

At the time of writing, electron doesn't support ES modules so everything is transpiled to commonjs. This has the consequence that some updated libraries supporting only esm can't be used (e.g. new versions of d3). It also means that asynchronous imports (`const foo = await import('bar')`) are actually synchronous at runtime. Doesn't really matter though since everything is baked into a single file on release builds anyway and code splitting isn't really needed.

### Reporting Bugs

Please report issues on GitHub and include at the very least the following information:
- The exact version of Vortex you're using
- Your OS
- What you were doing when the bug happened
- What exactly the bug is (crash? error messages? unexpected behaviour?)
- If you get any error message, include the full and exact error message. Do not paraphrase, do not leave out information that looks cryptic or unimportant to you
- The log file (see below)
- Ideally also the application state (see below)

All data the client generates (including settings and logs) are stored at:

| Build Type | Location | Common Path |
| --- | --- | --- |
| Release | `%AppData%\Vortex` | `C:\Users\<USERNAME>\AppData\Roaming\Vortex` |  
| Dev | `%AppData%\vortex_devel` | `C:\Users\<USERNAME>\AppData\Roaming\vortex_devel` |

If you need to report a bug, the following paths inside that directory may be useful in addition to the error message displayed on screen:

- `\vortex.log` (logs are rotated at a certain size, this is the latest one)
- `\state\` except global_account (that one contains keys and passwords so sensitive information)
- `\<game>\state\` (if the bug pertains to a specific game)

### Troubleshooting

TODO: Manual steps with dependencies and versions

## Resources

- [Download Vortex](https://www.nexusmods.com/site/mods/1?tab=files) from Nexus Mods
- [GitHub](https://github.com/Nexus-Mods/Vortex) for source code, issues, and pull requests.
- [Vortex Forum](https://forums.nexusmods.com/index.php?/forum/4306-vortex-support/) or [Discord](https://discord.gg/nexusmods) for support and discussions with the community and the team.
- [Vortex Wiki](https://github.com/Nexus-Mods/Vortex/wiki) for knowledge base, articles and troubleshooting
- [Project Structure](structure.md) for an overview of how the codebase is organized.

## Contributing

The majority of Vortex code is open-source. We are committed to a transparent development process and highly appreciate any contributions. Whether you are helping us fix bugs, proposing new features, improving our documentation or spreading the word - we would love to have you as a part of the Vortex community. 

- Bug Report: If you see an error message or encounter an issue while using Amplication, please create a [bug report](https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=).

- Feature Request: If you have an idea or if there is a capability that is missing and would make development easier and more robust, please submit a [feature request](https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=&projects=&template=feature_request.md&title=).

- Review Extension: If you're creating a game extension and need us to review it, please submit a [review extension](https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=extension+%3Agear%3A&projects=&template=review-extension.yaml&title=Review%3A+Game+Name) request.

## License

A this project is licensed under the [GPL-3.0](https://github.com/Nexus-Mods/Vortex/blob/master/LICENSE.md) license.
