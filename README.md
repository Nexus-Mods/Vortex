# Usage

- Before you can build vortex you need to download and install a couple of dependencies.
  - node.js
    * download installer from https://nodejs.org and run
    * version doesn't matter much, latest tls should be fine
  - yarn
    * install through npm _"npm install --global yarn"_
  - git
    * download installer (64-bit) from https://git-scm.com and run
    * default settings are fine
  - python 2.7
    * download installer (2.7.*, 64-bit) from https://www.python.org/downloads/ and run
    * defaults are fine, you can disable samples and documentation if you want
  - c++ build tools 2015
    * download installer from http://landinghub.visualstudio.com/visual-cpp-build-tools and run
    * default settings are fine
    * Note: I'm fairly certain any newer version will also work but it's untested
  - Call _"yarn config set msvs_version 2015 --global"_
    * This sets up yarn to use the c++ build tools we just installed
    * If you downloaded a newer version, change the version accordingly
- Check out the repository
  * _git clone https://github.com/Nexus-Mods/Vortex-Private.git vortex_
- Switch to the appropriate branch if necessary
  * _git checkout somebranch_
- For development
  * _"yarn run installex"_ to build (this will take a while)
  * _"yarn run start"_ to run.
- For production
  * _"yarn dist"_ to build (this will take a while)
  * Find the installer and an alread unpacked version in dist

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