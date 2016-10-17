# Usage

- Install node.js (version 6.x)
- check out repository
- run "npm install" to install all dependencies
- (temporary) change directory to "node_modules/redux-persist" and run "npm run build". If you get an error "Error: spawn webpack ENOENT", ignore it. Then cd back
- Ensure you have python 2.7 installed. If you also have python 3, run "npm config set python python2.7"
- run "npm run native" to rebuild native dependencies on the current platform
- run "npm run start" to build & run
- run "npm run package" to create a distribution

# Further Information

- see structure.md for an overview of how the project is organized
- see the wiki for a description of the extension api
- run "npm run doc" the create an html page from code documentation
