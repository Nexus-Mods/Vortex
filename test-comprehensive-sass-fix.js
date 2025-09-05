const path = require('path');
const sass = require('sass');

// Simulate the paths that would be used in the StyleManager with our comprehensive fix
const assetsPath = path.join(__dirname, 'app', 'assets', 'css');
const modulesPath = path.join(__dirname, 'node_modules');
const applicationPath = __dirname;
const srcStylesPath = path.join(applicationPath, 'src', 'stylesheets');
const rootPath = applicationPath;
const appPath = path.join(applicationPath, 'app');
const assetsRootPath = path.join(appPath, 'assets', 'css');
const assetsBasePath = path.join(appPath, 'assets'); // Add this path for assets resolution

const includePaths = [
  assetsPath,
  modulesPath,
  srcStylesPath,
  rootPath,
  appPath,
  assetsRootPath,
  assetsBasePath
];

console.log('Testing comprehensive SASS compilation with all import paths...');
console.log('Include paths:', includePaths);

// Test if the paths exist
const fs = require('fs');
console.log('Assets path exists:', fs.existsSync(assetsPath));
console.log('Src styles path exists:', fs.existsSync(srcStylesPath));
console.log('Root path exists:', fs.existsSync(rootPath));
console.log('App path exists:', fs.existsSync(appPath));
console.log('Assets root path exists:', fs.existsSync(assetsRootPath));
console.log('Assets base path exists:', fs.existsSync(assetsBasePath));

// Test case 1: Collections extension import path
console.log('\n=== Test Case 1: Collections extension import path ===');
const testSCSS1 = `
@import '../../src/stylesheets/variables.scss';

.test-class-1 {
  color: $brand-primary;
}
`;

try {
  const result1 = sass.renderSync({
    data: testSCSS1,
    includePaths: includePaths,
    outputStyle: 'compressed'
  });
  
  console.log('Test 1 - SASS compilation successful!');
  console.log('CSS output length:', result1.css.length);
} catch (error) {
  console.error('Test 1 - SASS compilation failed:', error.message);
  if (error.formatted) {
    console.error('Formatted error:', error.formatted);
  }
}

// Test case 2: Titlebar launcher extension import path
console.log('\n=== Test Case 2: Titlebar launcher extension import path ===');
const testSCSS2 = `
@import '../src/stylesheets/variables.scss';

.test-class-2 {
  color: $brand-primary;
}
`;

try {
  const result2 = sass.renderSync({
    data: testSCSS2,
    includePaths: includePaths,
    outputStyle: 'compressed'
  });
  
  console.log('Test 2 - SASS compilation successful!');
  console.log('CSS output length:', result2.css.length);
} catch (error) {
  console.error('Test 2 - SASS compilation failed:', error.message);
  if (error.formatted) {
    console.error('Formatted error:', error.formatted);
  }
}

// Test case 3: Documentation extension import path
console.log('\n=== Test Case 3: Documentation extension import path ===');
const testSCSS3 = `
@import "../../../assets/css/variables.scss";

.test-class-3 {
  color: $brand-primary;
}
`;

try {
  const result3 = sass.renderSync({
    data: testSCSS3,
    includePaths: includePaths,
    outputStyle: 'compressed'
  });
  
  console.log('Test 3 - SASS compilation successful!');
  console.log('CSS output length:', result3.css.length);
} catch (error) {
  console.error('Test 3 - SASS compilation failed:', error.message);
  if (error.formatted) {
    console.error('Formatted error:', error.formatted);
  }
}

console.log('\n=== All tests completed ===');