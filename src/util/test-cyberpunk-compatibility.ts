/**
 * Test script for Cyberpunk 2077 macOS compatibility validation
 * This script tests the compatibility validation functions with sample mod structures
 */

import {
  validateCyberpunkMacOSCompatibility,
  hasWindowsOnlyFiles,
  hasWindowsOnlyDirectories,
  hasWindowsOnlyFrameworks,
  createMacOSCompatibilityErrorMessage
} from './macOSGameCompatibility';

// Test cases for different mod structures
const testCases = [
  {
    name: 'Compatible macOS mod (archive only)',
    files: [
      'archive/pc/mod/mymod.archive',
      'archive/pc/mod/textures.archive',
      'info.json'
    ],
    expectedCompatible: true
  },
  {
    name: 'Incompatible mod with RED4ext (Windows-only framework)',
    files: [
      'red4ext/plugins/mymod.dll',
      'archive/pc/mod/mymod.archive',
      'info.json'
    ],
    expectedCompatible: false
  },
  {
    name: 'Incompatible mod with CET (Windows-only framework)',
    files: [
      'bin/x64/plugins/cyber_engine_tweaks/mods/mymod/init.lua',
      'archive/pc/mod/mymod.archive'
    ],
    expectedCompatible: false
  },
  {
    name: 'Incompatible mod with DLL files',
    files: [
      'bin/x64/mymod.dll',
      'plugins/mymod.asi',
      'archive/pc/mod/mymod.archive'
    ],
    expectedCompatible: false
  },
  {
    name: 'Incompatible mod with Windows-only directories',
    files: [
      'engine/config/mymod.xml',
      'bin/scripts/mymod.lua',
      'archive/pc/mod/mymod.archive'
    ],
    expectedCompatible: false
  },
  {
    name: 'Compatible redscript mod',
    files: [
      'r6/scripts/mymod/mymod.reds',
      'r6/scripts/mymod/utils.reds',
      'archive/pc/mod/mymod.archive'
    ],
    expectedCompatible: true
  },
  {
    name: 'Mixed compatibility (should be incompatible)',
    files: [
      'r6/scripts/mymod/mymod.reds',  // Compatible
      'red4ext/plugins/mymod.dll',   // Incompatible
      'archive/pc/mod/mymod.archive' // Compatible
    ],
    expectedCompatible: false
  }
];

/**
 * Run compatibility validation tests
 */
async function runCompatibilityTests(): Promise<void> {
  console.log('🧪 CYBERPUNK 2077 MACOS COMPATIBILITY VALIDATION TESTS');
  console.log('='.repeat(60));
  
  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`   Files: ${testCase.files.join(', ')}`);
    
    try {
      // Test individual validation functions
      const hasWinFiles = hasWindowsOnlyFiles(testCase.files);
      const hasWinDirs = hasWindowsOnlyDirectories(testCase.files);
      const hasWinFrameworks = hasWindowsOnlyFrameworks(testCase.files);
      
      console.log(`   Windows-only files: ${hasWinFiles}`);
      console.log(`   Windows-only directories: ${hasWinDirs}`);
      console.log(`   Windows-only frameworks: ${hasWinFrameworks}`);
      
      // Test full validation
      const validationResult = await validateCyberpunkMacOSCompatibility('/tmp/test', testCase.files);
      
      const actualCompatible = validationResult.isCompatible;
      const testPassed = actualCompatible === testCase.expectedCompatible;
      
      if (testPassed) {
        console.log(`   ✅ PASSED - Compatible: ${actualCompatible}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Expected: ${testCase.expectedCompatible}, Got: ${actualCompatible}`);
        if (!actualCompatible && validationResult.errorMessage) {
          console.log(`   Error: ${validationResult.errorMessage}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR - ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Compatibility validation is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the validation logic.');
  }
  
  // Test error message generation
  console.log('\n📝 Testing error message generation:');
  const errorMessage = createMacOSCompatibilityErrorMessage(['RED4ext framework', 'CET framework', '.dll files', '.asi files', 'bin directory', 'plugins directory']);
  console.log(errorMessage);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runCompatibilityTests().catch(console.error);
}

export { runCompatibilityTests };