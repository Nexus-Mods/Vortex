// Simple verification script for our file system migration
const { spawnSync } = require('child_process');

console.log('Verifying file system migration implementation...');

// Test 1: Check that patternMatcher.ts exists and has the right functions
console.log('\n1. Checking patternMatcher.ts file...');
const fs = require('fs');
const path = require('path');

const patternMatcherPath = path.join(__dirname, 'src', 'util', 'patternMatcher.ts');
if (fs.existsSync(patternMatcherPath)) {
  console.log('✅ patternMatcher.ts exists');
  const content = fs.readFileSync(patternMatcherPath, 'utf8');
  if (content.includes('globToRegex') && content.includes('matchPattern') && content.includes('findFiles')) {
    console.log('✅ Required functions found in patternMatcher.ts');
  } else {
    console.log('❌ Missing required functions in patternMatcher.ts');
  }
} else {
  console.log('❌ patternMatcher.ts not found');
}

// Test 2: Check that BuildSubprojects.js was updated
console.log('\n2. Checking BuildSubprojects.js update...');
const buildSubprojectsPath = path.join(__dirname, 'BuildSubprojects.js');
if (fs.existsSync(buildSubprojectsPath)) {
  console.log('✅ BuildSubprojects.js exists');
  const content = fs.readFileSync(buildSubprojectsPath, 'utf8');
  if (content.includes('patternMatcher')) {
    console.log('✅ BuildSubprojects.js references patternMatcher');
  } else {
    console.log('❌ BuildSubprojects.js does not reference patternMatcher');
  }
} else {
  console.log('❌ BuildSubprojects.js not found');
}

// Test 3: Check that our validation scripts exist
console.log('\n3. Checking validation scripts...');
const submoduleCheckPath = path.join(__dirname, 'scripts', 'submodule-branch-check.js');
const completeValidationPath = path.join(__dirname, 'scripts', 'complete-validation.js');

if (fs.existsSync(submoduleCheckPath)) {
  console.log('✅ submodule-branch-check.js exists');
} else {
  console.log('❌ submodule-branch-check.js not found');
}

if (fs.existsSync(completeValidationPath)) {
  console.log('✅ complete-validation.js exists');
} else {
  console.log('❌ complete-validation.js not found');
}

// Test 4: Check package.json updates
console.log('\n4. Checking package.json updates...');
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.scripts && packageJson.scripts['check-submodules'] && packageJson.scripts['complete-validation']) {
    console.log('✅ Package.json has new validation scripts');
  } else {
    console.log('❌ Package.json missing new validation scripts');
  }
} else {
  console.log('❌ package.json not found');
}

console.log('\n✅ File system migration verification completed!');