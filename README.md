# Vortex

#### Building from source code

To build from source you have two choices.
### 1) Automatic (mostly):
- Download _bootstrap.ps1_ and run as a powershell script
  - In the dialog that shows up, select a build directory (should be a clean/new one)
  - This script will try to download and install all dependencies, then check out and build vortex
  - The dependencies are not installed headless so you have to click through the dialogs but it's only guaranteed to work if you keep the defaults

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

##### Python
- Required for one of the build tools (_node-gyp_). At the time of writing versions _3.7-3.10_ are known to work
- Download installer (64-bit) from [python.org](https://www.python.org/downloads/) and run installer
- Make sure to have it added to `PATH`, otherwise defaults are fine.
  - If you have trouble refer to [How to add Python to PATH variable in Windows](https://www.educative.io/answers/how-to-add-python-to-path-variable-in-windows)
  - You can disable samples and documentation if you want

##### Visual c++ build tools 2022 or Visual Studio 2022 (Community Edition)
- Download installer from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/en/downloads/) 
  - You may have to google around for this as Microsoft tends to change their sitemap all the bloody time
- In the installer, make sure you enable the build tools themselves, the latest windows SDK (version doesn't actually matter) and ATL headers. Everything else is optional.

##### Set up yarn to use C++ build tools
- Run `yarn config set msvs_version 2022 --global`
  - This sets up yarn to use the c++ build tools we just installed, you probably only need to do this if you've also installed other versions of Visual Studio. Can't hurt though

#### Cloning and building the Vortex source code
- Create and `cd` to an appropriate directory (i.e. _c:\projects_)
- `git clone https://github.com/Nexus-Mods/Vortex.git` from the created directory
  - this should create a new directory _vortex_ in the current working directory (i.e. _c:\projects\vortex_)
- Go into the vortex directory `cd vortex`
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

### If something goes wrong:

The build tools are unfortunately not particularly robust, so the build may break for various reasons (i.e. network problems, dependencies that changed remotely, ...) and leave the checkout in an inconsistent state.
In that case you will have to see if the error is something that needs to be fixed, then restart from the last step that failed.

The automatic variant will skip dependency download and install if the download was installed previously. If a dependency install failed for some reason or you cancelled it, you will have to manually install that package (see the downloads directory).

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
