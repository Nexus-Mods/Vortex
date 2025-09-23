#!/usr/bin/env node

// Test script for the project setup verification tool

const { verifySubmodules, verifySCSSCompilation } = require('./project-setup-verification.js');

async function runTests() {
  console.log('Running tests for project setup verification tool...\n');
  
  try {
    console.log('Test 1: Submodule verification');
    const submoduleResult = await verifySubmodules();
    console.log(`Submodule verification test: ${submoduleResult ? 'PASSED' : 'FAILED'}\n`);
    
    console.log('Test 2: SCSS compilation verification');
    const scssResult = await verifySCSSCompilation();
    console.log(`SCSS compilation verification test: ${scssResult ? 'PASSED' : 'FAILED'}\n`);
    
    console.log('All tests completed.');
    process.exit(submoduleResult && scssResult ? 0 : 1);
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}