# Usage

- Install node.js (version 6.x. Exact version doesn't matter)
- check out repository
- call _"npm run installex"_ to install and build all dependencies. This may take a bit
- Ensure you have python 2.7 installed. If you also have python 3, run "npm config set python python2.7"
- run "npm run start" to build & run
- run "npm run package" to create a distribution

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

_C:\Users\\<username\>\AppData\Roaming\Vortex Retribution_ (releases)

or

_C:\Users\\<username\>\AppData\Roaming\Vortex_ (development build)

If you need to report a bug, the following files inside that directory may be useful in addition to the error message displayed on screen:

- vortex.log (logs are rotated at a certain size, this is the latest one)
- state\\* except global_account (that one contains keys and passwords so sensitive information)
- \<game\>\state\* (if the bug pertains to a specific game)