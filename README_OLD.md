# Vortex

![Last Commit](https://img.shields.io/github/last-commit/Nexus-Mods/Vortex)
![Build](https://img.shields.io/github/actions/workflow/status/Nexus-Mods/Vortex/main.yml)
![Release](https://img.shields.io/github/v/release/Nexus-Mods/Vortex?logo=github)
![Pre-release](https://img.shields.io/github/v/release/Nexus-Mods/Vortex?include_prereleases&label=pre-release&logo=github)
![Contributors](https://img.shields.io/github/contributors/Nexus-Mods/Vortex)
![Forks](https://img.shields.io/github/forks/Nexus-Mods/Vortex?style=flat&logo=github)
![Stars](https://img.shields.io/github/stars/Nexus-Mods/Vortex?style=flat&logo=github)
![Watchers](https://img.shields.io/github/watchers/Nexus-Mods/Vortex?style=flat&logo=github)
![License GPL-3.0](https://img.shields.io/github/license/Nexus-Mods/Vortex)

![Nexus Mods](https://img.shields.io/website?url=https%3A%2F%2Fwww.nexusmods.com&label=nexusmods.com)
![Discord](https://img.shields.io/discord/215154001799413770?label=discord)

![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![Electron.js](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Redux](https://img.shields.io/badge/redux-%23593d88.svg?style=for-the-badge&logo=redux&logoColor=white)
![SASS](https://img.shields.io/badge/SASS-hotpink.svg?style=for-the-badge&logo=SASS&logoColor=white)
![Webpack](https://img.shields.io/badge/webpack-%238DD6F9.svg?style=for-the-badge&logo=webpack&logoColor=black)
![Yarn](https://img.shields.io/badge/yarn-%232C8EBB.svg?style=for-the-badge&logo=yarn&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
## Building from source code

To build from source you have two choices.
### 1) Automatic (mostly):
- Start a powershell
- Run `Invoke-WebRequest "https://raw.githubusercontent.com/Nexus-Mods/Vortex/master/bootstrap.ps1" -OutFile bootstrap.ps1` to fetch the bootstrap script
- By default this script will build Vortex in "c:\build\vortex", if you want it somewhere else, edit the script to change the build directory before running it!
- You will more than likely need to allow scripts to be run. This can be set using `Set-ExecutionPolicy Unrestricted` but a powershell with admin access is required. 
- Run the script (`.\bootstrap.ps1`)
  - This script will try to download and install all dependencies, then check out and build vortex
  - Most dependencies are installed using scoop (https://scoop.sh)

### 2) Manual:
- Before you can build vortex you need to download and install a couple of dependencies. If any of the download links is no longer valid, try google or a search engine of your choice.

##### Node.js
- Download installer from [nodejs.org](https://nodejs.org) and run the installer
- Version should not matter, the latest LTS version should be fine
- Verify that Node has installed successfully by running `node --version` in your _cmd_ or _terminal_

##### Yarn
- Run `npm install --global yarn`
- Verify that Yarn has installed successfully by running `yarn --version` in your _cmd_ or _terminal_

##### Git
- Download installer (64-bit) from [git-scm.com](https://git-scm.com/downloads) and run installer
- Verify that Git has installed successfully byb running `git --version` in your _cmd_ or _terminal_

##### Python 3.10
- Required for one of the build tools (_node-gyp_).
- At the time of writing versions _3.7-3.10_ are known to work, _3.11_ is known to *not* work as it has a breaking change that breaks node-gyp as of 9.3.1
- Download installer (64-bit) from [python.org](https://www.python.org/downloads/) and run installer
- Make sure to have it added to `PATH`, otherwise defaults are fine.
  - If you have trouble refer to [How to add Python to PATH variable in Windows](https://www.educative.io/answers/how-to-add-python-to-path-variable-in-windows)
  - You can disable samples and documentation if you want

##### CMake
- Required for some of the native builds, All versions that are even remotely recent should work
- Download installer (x64) from [cmake.org](https://cmake.org/download/#latest) and run installer
- Enable the option to add to `PATH` (for the current user or all users)

##### Visual c++ build tools 2022 or Visual Studio 2022 (Community Edition)
- Download installer from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/en/downloads/) 
  - You may have to google around for this as Microsoft tends to change their sitemap all the bloody time
- Under "Workloads", enable "Desktop Development with C++"
- Under "Individual Components", enable ".NET 6.0 Runtime (LTS)", ".NET SDK", "C++ ATL for latest vXYZ build tools" and "Windows 1x SDK" (any version should be fine)

##### Set up yarn to use C++ build tools
- Run `yarn config set msvs_version 2022 --global`
  - This sets up yarn to use the c++ build tools we just installed, you probably only need to do this if you've also installed other versions of Visual Studio. Can't hurt though

#### Cloning and building the Vortex source code
- Start a new command line prompt at this point to ensure you're using the updated PATH environment.
- Create and `cd` to an appropriate directory (i.e. _c:\projects_)
- `git clone https://github.com/Nexus-Mods/Vortex.git` from the created directory
  - this should create a new directory _vortex_ in the current working directory (i.e. _c:\projects\vortex_)
- cd into the vortex directory `cd vortex`
- Switch to an appropriate branch, if necessary
  - `git checkout some_branch`
- For development
  - `yarn install` to install dependencies
  - `yarn build` to build
  - `yarn start` to run
- For production
  - The scripts (_electron-builder-oneclick.json_ and _electron-builder-advanced.json_) are set up to require code signing with
    a certificate you don't have so change that
  - `yarn dist` to build (this will take a while)
  - Find the installer and an already unpacked version in dist

### If something goes wrong

There are two phases to the process, installing dependencies and building.
However, dependent modules may also be compiled during the install phase, this is particularly true for native modules (modules written in C++ for example rather than javascript) if no pre-build binaries are available online. Thus you might get compilation errors during the "yarn install" step.

If the install step fails with an error mentioning c++ or node-gyp or cmake, this will usually mean that one of the tools (python, cmake, visual studio build tools) were not installed (correctly) or can't be found, please repeat the corresponding step above and double check you followed the instructions. Then repeat the "yarn install" step.
Unfortunately, with these tools being installed system-wide, it's also possible that your existing installs of other versions of these tools (visual studio build tools in particular) may interfere. We can only really promise this build works on a clean windows.

There is one component, fomod-installer, written in c# and at the time of writing its build will randomly fail for no reason. In this case you don't have to do anything special, just repeat the install step.

If the error message shows an error from webpack or a javascript error, this may mean that some package was updated and broke compatibility. It may also mean typescript is outdated.
Another possible error may be that your yarn cache is invalid such that even if you reinstall a package you still get a broken variant.
The yarn cache is at _%LOCALAPPDATA%\\Yarn\\Cache\\v6_ and it's safe to delete it, that will only cause some additional internet traffic.

The automatic variant will skip dependency download and install if the download was installed previously. If a dependency install failed for some reason or you cancelled it, you will have to manually install that package (see the downloads directory).

### Running the dev build

After building a dev build you can run it using `yarn start`

You can repeat the steps to install dependencies (`yarn install`) and the full build (`yarn build`) as necessary.

To save yourself time, you can rebuild just the bundled extensions (`yarn run subprojects`). If you're making changes to the core application you can run build in watch mode (`yarn run buildwatch`) which will be the same as yarn build but then will continue to watch for changes (only on the core application, not extensions!) and rebuild on demand.

## Development decisions

The following section aims to clarify and explain a few development decisions.

### development vs release builds

The toolchain for development builds and release builds is quite different.

In dev builds the typescript compiler (tsc) is used directly to transliterate each ts file to js individually, electron runs those files directly, dependencies are loaded from node_modules.

In release builds we use webpack and ts-loader to bake all ts files and dependencies into two javascript files (one for the main/browser process, one for the renderer).
electron-builder is used to bundle code&assets, generate an nsis installer, build it into (two variants) of exe installers and sign them (and all the executables and dlls we ship).
There are mulitple electron-builder configuration files for multiple variants, only "oneclick" and "advanced" are used for release builds, the others may be in different states of disrepair (though ci should work as well)

As a result, dev builds are easier to work with and building is much quicker but runtime is substantially.

Further, we use a two-package structure, meaning the /package.json file is used for all development and the build environment for releases (e.g. this file always controls the electron version being used/bundled) whereas /app/package.json decides settings (name, version, dependencies) for the release builds only.
We use a custom script (checkPackages.js) to ensure that the dependencies for release are a subset of the build env dependencies and that they use the same version to avoid problems that didn't occur during testing because of differing dependencies.

Bundled extensions on the other hand are built the same between dev and release: they are always built with webpack and each have their own build setup - with the exception of simple game extensions which are already single js files, those simply get copied over.

### yarn 1 vs yarn 3 vs npm vs pnpm

This codebase still use yarn 1 (classic). Any attempt to use yarn 2 or 3 ended up with nonsensical errors (missing dependencies that are clearly listed, successive installs leading to missing packages) with no reasonable way to investigate why.
npm and pnpm are quite slow in comparison. We don't really use any yarn-specific features (workspaces?) so switching shouldn't be too difficult but for now yarn "classic" works.

### esm vs commonjs

At the time of writing, electron doesn't support ES modules so everything is transpiled to commonjs. This has the consequence that some updated libraries supporting only esm can't be used (e.g. new versions of d3).
It also means that asynchronous imports (`const foo = await import('bar')`) are actually synchronous at runtime. Doesn't really matter though since everything is baked into a single file on release builds anyway and code splitting isn't really needed.

------
# Further Information

- see [structure.md](structure.md) for an overview of how the project is organized
- see [https://nexus-mods.github.io/vortex-api](https://nexus-mods.github.io/vortex-api/) for a description of the extension api
- see [https://wiki.nexusmods.com/index.php/Vortex](https://wiki.nexusmods.com/index.php/Vortex) for usage information

# Reporting bugs

Please report issues to the issue tracker on github. Please always include at the very least the following information:
- The exact version of Vortex you're using
- Your operating system
- What you were doing when the bug happened
- What exactly the bug is (crash? error messages? unexpected behaviour?)
- If you get any error message, include the full and exact error message. Do not paraphrase, do not leave out information that looks cryptic or unimportant to you
- The log file (see below)
- Ideally also the application state (see below)

All data the client generates (including settings and logs) are stored at

_C:\Users\\<username\>\AppData\Roaming\Vortex_ (releases)

or

_C:\Users\\<username\>\AppData\Roaming\vortex\_devel_ (development build)

If you need to report a bug, the following files inside that directory may be useful in addition to the error message displayed on screen:

- vortex.log (logs are rotated at a certain size, this is the latest one)
- state\\* except global_account (that one contains keys and passwords so sensitive information)
- \<game\>\state\* (if the bug pertains to a specific game)
