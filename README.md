# Usage

- Install node.js (version doesn't matter much, latest tls should be fine)
- Download git from https://git-scm.com and install (all default settings should be fine)
- Run Powershell as Administrator
  - Run _"npm install --global --production windows-build-tools"_
    * This installs python and visual studio compiler for c++ and C# modules. It can take a while
  - Run _"npm config set msvs_version 2015 --global"_
    * This makes the node package manager use the correct visual studio build tools.
  - Close Powershell, open a new cmd.exe to run the remaining commands
- Check out the repository. Remember to switch to the appropriate branch if necessary.
- Call _"npm run installex"_ to install and build all dependencies. This may take a bit
- Run _"npm run start"_ to build & run
- Run _"npm run package"_ to create a distribution

# Further Information

- see structure.md for an overview of how the project is organized
- see the wiki for a description of the extension api
- run "npm run doc" the create an html page from code documentation

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