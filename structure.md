# Project structrue

- **/**: project base directory. contains mostly configuration on the top level
  - **src/**: Vortex source code
    - *main.ts*: Entry point of the main process
    - *renderer.tsx*: Entry point of render processes
    - *actions/index.ts*: globally available actions that can be called to manipulate application state (extensions can of course declare their own actions)
    - *index(.dev).html*: The top-level web-page being displayed. This is very minimal as the actual content is inserted in renderer.tsx. The variant for development has more relaxed CSPs to ease development
    - **extensions/**: embedded extensions (statically loaded)
    - **reducers/**: contains the core application reducers that are run as the result of actions to modify application state. Extensions will add their own reducers on top of these.
      - *index.ts*: top-level index, references the other reducer files
    - **types/**: contains interfaces for our own data types
    - **util/**: contains classes that didn't fit anywhere else
    - **controls/**: contains reusable react components used throughout the application (and exposed through the api)
    - **views/**: contains the react views that make up the main application user interface
    - **stylesheets/**: (s)css for the default application look
  - **extensions/**: bundled extensions (dynamically loaded but shipped with the main application)
  - **\_\_mocks\_\_/**: mocks for use in unit tests
  - **\_\_tests\_\_/**: unit tests
  - **.vscode/**: Configuration files for Visual Studio Code
    - *launch.json*: launch options (F5 primarily)
    - *tasks.json*: ide build commands (ctrl-shift-b)
    - *settings.json*: project-wide customizations of the ide (editor settings)
  - **build/**: contains assets for the packaging process (i.e. application icon)
  - **app/**: staging directory for production build
    - *package.json*: project file for production
  - **dist/**: production builds (one-click installer, updater) (unpacked and instellers, created during packaging)
  - **dist_custom/**: production builds (lets user choose installation directory)
  - **out/**: development build (created by *npm build*)
  - **node_modules/**: dependencies (created by *npm install*)
  - **typings/**: public typings auto-retrieved from public repositories
  - **typings.custom/**: custom typings for libraries that don't have any yet or where those that exist are incomplete or broken 
    - *index.d.ts*: top-level index, references the other typings

# Configuration files
- package.json: project file for development
- tsconfig.json: configuration file for the typescript compiler 
- .eslintrc.js: configuration for our coding guidelines
- .npmrc: configuration for npm/yarn, mostly controlling settings for native module builds
- BuildSubprojects.json: configuration for bundled extensions
- electron-builder-\*.json: configuration for (various) installers, only oneclick, advanced and ci are actively being used, the rest is there for reference
- InstallAssets.json: lists static assets to be included in builds (can specify if assets are for development, production or both)
- versions.json: specifies minimum Vortex version that is allowed to send feedback. Not sure if this is actually obeyed by the server
- webpack.*.config.js: bundler configuration for release builds (development builds are not bundled)

# Utility scripts
- bootstrap.ps1: Automatically installs the tools required to build Vortex, checks out the repo, starts a development build
- updateLicenses.js: Update list of included third-party modules and their licenses, gets displayed on the About screen.

# Scripts used as part of the install/build process
- checkPackages.js: Verifies there are no discrepancies between the two package.json files
- BuildSubprojects.js: Builds all bundled extensions that have been modified since the last invocation
- createMD5List.js: Generate list of md5 hashes of all files included in a build, used at startup (in release builds) to verify the Vortex install hasn't been corrupted
- InstallAssets.js: Install static asset files to the correct location
- postinstall.js: verifies all native modules were built, yarn doesn't necessarily produce an error message if noe failed. Will further warn if modules that we expect to get prebuilt had to be built
- setupTests.js: part of the jest unit testing framework


# package.json tasks

- install: download&install dependencies, this will also build native dependencies
- build: build project (for development)
- buildwatch: build project (for development) and watch for changes
- subprojects: build only bundled extensions (for development)
- test: run test suite
- start: starts the program in development mode
- dist: build for release, creating two installers (one-click and one asking for installation directory)
- ci: create unsigned release build
