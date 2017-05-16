# Project structrue

- **/**: project base directory. contains mostly configuration on the top level
  - *package.json*: project file for development
  - *tsconfig.json*: configuration file for the typescript compiler 
  - *tslint.json*: configuration for our coding guidelines
  - *typings.json*: list of typescript wrappers
    (This thing requires maintenance as the configuration file lists precise
    version numbers)
  - *.babelrc*: configuration for the babel transpiler (babel enables the use
    of more modern js and can apply various code tranformations for optimization
    and such. I'm honestly not 100% clear how it interacts with the typescript
    compiler)
  - **src/**: Vortex source code
    - *main.ts*: Entry point of the main process
    - *renderer.tsx*: Entry point of render processes
    - *actions/actions.ts*: contains the actions that can be called to manipulate
      application state
    - *index.html*: The top-level web-page being displayed. This is very minimal as
      the actual content is inserted in renderer.tsx
    - **reducers/**: contains the reducers that are run as the result of actions to
      modify application state
      - *index.ts*: top-level index, references the other reducer files
    - **types/**: contains interfaces for our own data types
    - **util/**: contains classes that didn't fit anywhere else
    - **views/**: contains the react views that make up the user interface
  - **\_\_tests\_\_/**: unit tests
  - **.vscode/**: Configuration files for Visual Studio Code
    - *launch.json*: launch options (F5 primarily)
    - *tasks.json*: ide build commands (ctrl-shift-b)
    - *settings.json*: project-wide customizations of the ide (editor settings)
  - **build/**: contains assets for the packaging process (i.e. application icon)
  - **app/**: staging directory for production build
    - *package.json*: project file for production
  - **dist/**: production builds (unpacked and instellers, created during packaging)
  - **out/**: development build (created during build)
  - **doc/**: api documentation (created by *npm run doc*)
  - **node_modules/**: dependencies (created by *npm install*)
  - **typings/**: public typings auto-retrieved from public repositories
  - **typings.custom/**: custom typings for libraries that don't have any yet or where
    those that exist are incomplete or broken 
    - *index.d.ts*: top-level index, references the other typings

# npm tasks

- install: download&install dependencies, also downloads typings
- test: run test suite
- doc: create api documentation
- start: compiles typescript, updates all assets, then starts the program in
  development mode
- package: creates a distributable installer. Also updates all assets and compiles
  typescript in the process
