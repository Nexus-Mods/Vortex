const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = path.join(__dirname, 'dotnetprobe');
const outputFile = path.join(__dirname, '..', 'assets', 'dotnetprobe.exe');

// Check if dotnetprobe.exe already exists
if (fs.existsSync(outputFile)) {
  const stats = fs.statSync(outputFile);
  console.log(`dotnetprobe.exe already exists (${Math.round(stats.size / 1024)}KB) - skipping build`);
  process.exit(0);
}

console.log('Building dotnetprobe.exe for .NET 9...');

try {
  // Check if dotnet is available
  execSync('dotnet --version', { stdio: 'pipe' });

  // Build dotnetprobe
  execSync(
    'dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o ../../assets',
    {
      cwd: projectDir,
      stdio: 'inherit'
    }
  );

  // Verify the output file exists
  if (fs.existsSync(outputFile)) {
    const stats = fs.statSync(outputFile);
    console.log(`✓ dotnetprobe.exe built successfully (${Math.round(stats.size / 1024)}KB)`);
  } else {
    console.error('✗ dotnetprobe.exe was not created');
    process.exit(1);
  }
} catch (err) {
  console.error('Error building dotnetprobe:', err.message);
  console.log('Skipping dotnetprobe build - .NET SDK may not be installed');

  // Check if the existing exe is present
  if (fs.existsSync(outputFile)) {
    console.log('Using existing dotnetprobe.exe');
  } else {
    console.warn('WARNING: dotnetprobe.exe is missing and could not be built');
  }
}