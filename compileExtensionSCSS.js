const fs = require('fs');
const path = require('path');
const sass = require('sass');
const glob = require('glob');

// Function to compile SCSS files in all extensions
function compileExtensionSCSS(targetDir) {
  console.log(`Compiling SCSS files in all extensions for ${targetDir}...`);
  
  // Find all SCSS files in the source extensions directory
  const sourceExtensionsDir = path.join(__dirname, 'extensions');
  
  // Patterns to find SCSS files in different extension types
  const scssPatterns = [
    path.join(sourceExtensionsDir, '**', '*.scss') // Recursively find all SCSS files
  ];
  
  let allScssFiles = [];
  scssPatterns.forEach(pattern => {
    const files = glob.sync(pattern);
    allScssFiles = allScssFiles.concat(files);
  });
  
  // Remove duplicates and filter out node_modules and dist directories
  const scssFiles = [...new Set(allScssFiles)].filter(file => 
    !file.includes('node_modules') && 
    !file.includes('/dist/') &&
    !file.includes('vortex-api/')
  );
  
  console.log(`Found ${scssFiles.length} SCSS files to compile`);
  
  scssFiles.forEach(scssFile => {
    try {
      console.log(`Compiling: ${scssFile}`);
      
      // Compile SCSS to CSS
      const result = sass.renderSync({
        file: scssFile,
        outputStyle: 'compressed',
        includePaths: [
          path.join(__dirname, 'src/stylesheets'),
          path.join(__dirname, 'assets/css'),
          path.join(__dirname, 'node_modules/bootstrap-sass/assets/stylesheets')
        ]
      });
      
      // Determine the output path
      const relativePath = path.relative(sourceExtensionsDir, scssFile);
      let outputDir;
      
      // Handle different extension types
      const pathParts = relativePath.split('/');
      
      if (relativePath.startsWith('games/')) {
        // Game extensions: extensions/games/game-name -> bundledPlugins/game-name
        const gameExtensionPath = relativePath.replace('games/', '');
        outputDir = path.join(targetDir, 'bundledPlugins', path.dirname(gameExtensionPath));
      } else if (relativePath.startsWith('theme-switcher/themes/')) {
        // Theme files: extensions/theme-switcher/themes/theme-name -> bundledPlugins/theme-switcher/themes/theme-name
        outputDir = path.join(targetDir, 'bundledPlugins', path.dirname(relativePath));
      } else {
        // For all other extensions, use the first directory as the extension name
        const extensionName = pathParts[0];
        outputDir = path.join(targetDir, 'bundledPlugins', extensionName);
      }
      
      const cssFileName = path.basename(scssFile, '.scss') + '.css';
      const outputFile = path.join(outputDir, cssFileName);
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write CSS file
      fs.writeFileSync(outputFile, result.css);
      
      console.log(`✓ Compiled: ${path.basename(scssFile)} -> ${outputFile}`);
      
      // Remove the SCSS file from the output directory if it exists
      const scssOutputFile = path.join(outputDir, path.basename(scssFile));
      if (fs.existsSync(scssOutputFile)) {
        fs.unlinkSync(scssOutputFile);
        console.log(`✓ Removed: ${scssOutputFile}`);
      }
      
    } catch (error) {
      console.error(`✗ Failed to compile ${scssFile}:`, error.message);
    }
  });
  
  console.log('Extension SCSS compilation completed.');
}

// Get target directory from command line arguments
const targetDir = process.argv[2] || 'out';
compileExtensionSCSS(targetDir);