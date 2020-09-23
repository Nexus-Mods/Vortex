# Usage

To build from source you have two choices.

Automatic (mostly):
- download _bootstrap.ps1_ and run as a powershell script
  - in the dialog that shows up, select a build directory (should be a clean/new one)
  - this script will try to download and install all dependencies, then check out and build vortex
  - the dependencies are not installed headless so you have to click through the dialogs but it's only guaranteed to work if you keep the defaults

Manual:
- Before you can build vortex you need to download and install a couple of dependencies.
  If any of the download links is no longer valid, try google or a search engine of your choice.
  - node.js
    * download installer from https://nodejs.org and run
    * version doesn't matter much, latest lts should be fine
  - yarn
    * install through npm _"npm install --global yarn"_
  - git
    * download installer (64-bit) from https://git-scm.com and run
    * default settings are fine
  - python
    * This has been tested with python 3.8 but any version since 2.7 should work. Newer versions may be supported with a delay,
      if in doubt, please check the compatibility table of node-gyp
    * download installer (64-bit) from https://www.python.org/downloads/ and run
    * make sure to have it added to PATH, otherwise defaults are fine. You can disable samples and documentation if you want
  - c++ build tools 2017
    * You may have to google around for this as Microsoft tends to change their site and url schemas all the bloody time
    * They also change the directory layout of their tools all the time, which is why we actually need the 2017 tools here, the
      2019 ones are not compatible (although it will probably not be a problem if you have them installed as well)
    * download "Build Tools für Visual Studio 2017" and run
    * In the installer, make sure you enable the build tools themselves, the latest windows SDK (version doesn't actually matter) and ATL headers,
      everything else is optional
  - Call _"yarn config set msvs_version 2017 --global"_
    * This sets up yarn to use the c++ build tools we just installed, you probably only need to do this
      if you've also installed other versions of Visual Studio. Can't hurt though
- Check out the repository
  * create and _cd_ to an appropriate directory (i.e. c:\projects)
  * _git clone https://github.com/Nexus-Mods/Vortex.git vortex_
    * this creates a new directory _vortex_ below the current working directory
  * _cd vortex_
- Switch to the appropriate branch if necessary
  * _git checkout somebranch_
- For development
  * _"yarn install"_ followed by _"yarn run build"_ to build
  * _"yarn run start"_ to run
- For production
  * The scripts  (electron-builder-oneclick.json and electron-builder-advanced.json) are set up to require code signing with
    a certificate you don't have so change that
  * _"yarn dist"_ to build (this will take a while)
  * Find the installer and an alread unpacked version in dist

### If something goes wrong:

The build tools are unfortunately not particularly robust, so the build may break for various reasons (i.e. network problems, dependencies that changed remotely, ...) and leave the checkout in an inconsistent state.
In that case you will have to see if the error is something that needs to be fixed, then restart from the last step that failed.

The automatic variant will skip dependency download and install if the download was installed previously. If a dependency install failed for some reason or you cancelled it, you will have to manually install that package (see the downloads directory).

# Further Information

- see structure.md for an overview of how the project is organized
- see the wiki for a description of the extension api
- run "yarn run doc" the create an html page from code documentation

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
