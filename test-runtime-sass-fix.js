const path = require('path');
const sass = require('sass');
const fs = require('fs');

// Try to mimic the actual runtime environment more closely
const projectRoot = __dirname;
const bundledPluginsDir = path.join(projectRoot, 'force', 'bundledPlugins', 'documentation');
const documentationSCSSPath = path.join(bundledPluginsDir, 'documentation.scss');

console.log('Project root:', projectRoot);
console.log('Documentation SCSS exists:', fs.existsSync(documentationSCSSPath));

// Read the actual documentation SCSS content
const documentationSCSS = fs.readFileSync(documentationSCSSPath, 'utf8');

// Try to compile it with the paths we think should work
const assetsPath = path.join(projectRoot, 'app', 'assets', 'css');
const modulesPath = path.join(projectRoot, 'node_modules');
const srcStylesPath = path.join(projectRoot, 'src', 'stylesheets');
const rootPath = projectRoot;
const appPath = path.join(projectRoot, 'app');
const assetsRootPath = path.join(appPath, 'assets', 'css');
const assetsBasePath = path.join(appPath, 'assets');

const includePaths = [
  assetsPath,
  modulesPath,
  srcStylesPath,
  rootPath,
  appPath,
  assetsRootPath,
  assetsBasePath
];

console.log('\nTrying to compile documentation SCSS with include paths...');
try {
  const result = sass.renderSync({
    file: documentationSCSSPath,
    includePaths: includePaths,
    outputStyle: 'compressed'
  });
  
  console.log('Documentation SCSS compilation successful!');
  console.log('CSS output length:', result.css.length);
} catch (error) {
  console.error('Documentation SCSS compilation failed:', error.message);
  if (error.formatted) {
    console.error('Formatted error:', error.formatted);
  }
  
  // Let's also try with just the data option
  console.log('\nTrying with data option...');
  try {
    const result2 = sass.renderSync({
      data: documentationSCSS,
      includePaths: includePaths,
      outputStyle: 'compressed'
    });
    
    console.log('Documentation SCSS compilation with data successful!');
    console.log('CSS output length:', result2.css.length);
  } catch (error2) {
    console.error('Documentation SCSS compilation with data failed:', error2.message);
    if (error2.formatted) {
      console.error('Formatted error:', error2.formatted);
    }
  }
}