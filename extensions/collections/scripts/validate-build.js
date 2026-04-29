#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Build validation script for the collections extension
 * Checks that all required files are generated during the build process
 */

console.log("🔍 Validating build outputs...");

const requiredFiles = [
  // Main outputs
  { path: "dist/index.js", description: "Webpack bundle" },

  // Copied assets
  { path: "dist/language.json", description: "Language file" },
  { path: "dist/icons.svg", description: "Icons file" },
  { path: "dist/collectionicon.svg", description: "Collection icon" },
  { path: "dist/style.scss", description: "Style file" },
  { path: "dist/fallback_tile.png", description: "Fallback tile image" },
];

const optionalFiles = [
  { path: "dist/info.json", description: "Extension info" },
  { path: "dist/hdiff.wasm", description: "bsdiff WASM module" },
  { path: "dist/bsdiffWorker.cjs", description: "bsdiff worker bundle" },
];

let hasErrors = false;
let warningCount = 0;

// Check required files
console.log("\n📋 Checking required files:");
for (const file of requiredFiles) {
  const filePath = path.join(process.cwd(), file.path);

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file.description}: ${file.path} (${stats.size} bytes)`);
  } else {
    console.error(`❌ ${file.description}: ${file.path} - FILE MISSING`);
    hasErrors = true;
  }
}

// Check optional files
console.log("\n📋 Checking optional files:");
for (const file of optionalFiles) {
  const filePath = path.join(process.cwd(), file.path);

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file.description}: ${file.path} (${stats.size} bytes)`);
  } else {
    console.warn(
      `⚠️  ${file.description}: ${file.path} - FILE MISSING (optional)`,
    );
    warningCount++;
  }
}

// Validate main bundle content
console.log("\n🔍 Validating bundle content:");
try {
  const mainBundle = path.join(process.cwd(), "dist/index.js");
  if (fs.existsSync(mainBundle)) {
    const bundleContent = fs.readFileSync(mainBundle, "utf8");

    // Check for common patterns that should be in the bundle
    const patterns = [
      { pattern: /module\.exports/, description: "Module exports" },
      { pattern: /webpack/, description: "Webpack runtime" },
    ];

    for (const { pattern, description } of patterns) {
      if (pattern.test(bundleContent)) {
        console.log(`✅ ${description} found in bundle`);
      } else {
        console.warn(`⚠️  ${description} not found in bundle`);
        warningCount++;
      }
    }

    // Check bundle size
    const bundleSize = bundleContent.length;
    if (bundleSize < 1000) {
      console.error(
        `❌ Bundle seems too small (${bundleSize} bytes) - possible build issue`,
      );
      hasErrors = true;
    } else {
      console.log(`✅ Bundle size looks reasonable (${bundleSize} bytes)`);
    }
  }
} catch (error) {
  console.error(`❌ Error validating bundle: ${error.message}`);
  hasErrors = true;
}

// Check TypeScript output
console.log("\n🔍 Validating TypeScript output:");
try {
  const tsOutput = path.join(process.cwd(), "out/index.js");
  if (fs.existsSync(tsOutput)) {
    const outputContent = fs.readFileSync(tsOutput, "utf8");

    // Check for source maps
    if (outputContent.includes("//# sourceMappingURL=")) {
      console.log("✅ Source maps generated");
    } else {
      console.warn("⚠️  Source maps not found");
      warningCount++;
    }

    // Check for module structure
    if (
      outputContent.includes("exports.") ||
      outputContent.includes("module.exports")
    ) {
      console.log("✅ CommonJS exports found");
    } else {
      console.error("❌ No exports found in TypeScript output");
      hasErrors = true;
    }
  }
} catch (error) {
  console.error(`❌ Error validating TypeScript output: ${error.message}`);
  hasErrors = true;
}

// Final report
console.log("\n📊 Build Validation Summary:");
if (hasErrors) {
  console.error(`❌ Build validation FAILED with errors`);
  process.exit(1);
} else if (warningCount > 0) {
  console.warn(`⚠️  Build validation PASSED with ${warningCount} warnings`);
  process.exit(0);
} else {
  console.log("✅ Build validation PASSED - all checks successful!");
  process.exit(0);
}
