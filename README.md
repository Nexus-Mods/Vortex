# Vortex

## Building from source

To build from source you have two choices.

### Getting dependencies automatically

Do note that this method is not perfect and may result in a bad/broken installation

- download _bootstrap.ps1_ and run the powershell script
- in the dialog that shows up, select a build directory (should be a clean/new one)
- this script will try to download and install all dependencies

### Manual

#### Node.js

##### From Nodejs.org

- go to [nodejs.org](https://nodejs.org/en/download/releases/), click download `Node.js.10.11.x` for your system.
- verify the installation by opening your console of choice and typing `node --version`.

##### From the Node Version Manager

The [Node Version Manger](https://github.com/coreybutler/nvm-windows) for **Windows** is great if you want to manage multiple installations of node.js on your PC.

- download and install the latest release on [GitHub](https://github.com/coreybutler/nvm-windows/releases) (use the setup version)
- open an elevated terminal and type `nvm install 10.11.0`
- `nvm use 10.11.0` after the download is finished

#### Yarn

- open an elevated terminal and install yarn using npm: `npm install --global yarn`
- verify the version using `yarn --version` (should be >= `1.17.3`)

### Git

- download and install git from [git-scm.com](https://git-scm.com/downloads) for your system
- verify the version using `git --version` (should be >= `2.21.0`)

### Python 2.7

- head over to [python.org](https://www.python.org/downloads/release/python-2717/) and download the `Windows x86 ... Installer` for your system.
- during installation use the following options:
  - `[*] Install for all users`
  - `C:\Python27\`
  - check all features options in the _Customize Python 2.7.17_ screen
- verify the installation using `python --version`
- configure `yarn` and `npm` to use python 2.7.17:
  - `yarn config set python python2.7`
  - `npm config set python python2.7`

### Visual Studio Build Tools 2017

- go to [visualstudio.microsoft.com/](https://visualstudio.microsoft.com/thank-you-downloading-visual-studio/?sku=BuildTools&rel=15&src=myvs#) to download the Visual Installer
- install `Visual Studio Build Tools 2017` (version: `15.9.16`)
- when asked what components/workloads to install choose the following:
  - `Workloads`:
    - `Visual C++ build tools`
  - `Individual components`:
    - `NuGet targets and build tasks` (in the _Code tools_ section)

(_you may need to restart your PC after installation is finished_)

- to verify the installation use `msbuild -version` from a console
- set up `yarn` to use these build tools:
  - `yarn config set msvs_version 2017 --global`

### Building

You want to fork this repository on GitHub and clone the fork to begin working.

- before you do anything use `yarn install` to install all dependencies.
- after that is finished use `yarn run build` and pray to god that it builds successfully
- when everything was build use `yarn run start` to start the dev environment of Vortex

When you want to package your Vortex build use `yarn dist`.

### Fixing build errors

The build tools are unfortunately not particularly stable or robust, so the build may break for various reasons (i.e. network problems, dependencies that changed remotely, ...) and leave the checkout in an inconsistent state.
In that case you will have to see if the error is something that needs to be fixed, then restart from the last step that failed.

The automatic variant will skip dependency download and install if the download was installed previously. If a dependency install failed for some reason or you cancelled it, you will have to manually install that package (see the downloads directory).

## Further Information

- see `structure.md` for an overview of how the project is organized
- see the [Wiki](https://github.com/Nexus-Mods/vortex-api/wiki) for a description of the extension api
- run `yarn run doc` the create an html page from code documentation

## Reporting bugs

Please report issues to the issue tracker on GitHub. Please always include at the very least the following information:

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
