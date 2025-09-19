const fs = require('fs');

console.log('Starting debug...');

try {
  console.log('1. Checking if BuildSubprojects.json exists...');
  const projectGroups = JSON.parse(fs.readFileSync('./BuildSubprojects.json', 'utf8').replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m));
  console.log('✅ BuildSubprojects.json loaded successfully');
  console.log(`Found ${projectGroups.length} project groups`);

  console.log('2. Checking if package.json exists...');
  const packageJSON = JSON.parse(fs.readFileSync('./package.json'));
  console.log('✅ package.json loaded successfully');

  console.log('3. Checking command line args...');
  const minimist = require('minimist');
  const args = minimist(process.argv.slice(2));
  console.log('Args:', args);

  console.log('4. Checking build directory...');
  const buildType = args._[0] || 'out';
  console.log('Build type:', buildType);

  console.log('5. Checking if out directory exists...');
  if (!fs.existsSync('./out')) {
    console.log('❌ out directory does not exist, creating it...');
    fs.mkdirSync('./out', { recursive: true });
    console.log('✅ out directory created');
  } else {
    console.log('✅ out directory exists');
  }

  console.log('6. Testing glob module...');
  const glob = require('glob');
  console.log('✅ glob module loaded successfully');

  console.log('All checks passed! The issue might be in the actual build process.');

} catch (error) {
  console.error('❌ Error during debug:', error.message);
  console.error('Stack:', error.stack);
}