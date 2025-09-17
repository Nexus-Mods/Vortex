// Simple test to verify the null checking logic
const { spawn } = require('child_process');

console.log('Testing null exit code handling...');

// Simulate the problematic scenario
function testNullExitCode() {
  // Create a child process that will be killed (resulting in null exit code)
  const child = spawn('sleep', ['10']);
  
  child.on('close', (code) => {
    console.log('Exit code received:', code);
    
    // Test our null checking logic
    if (code === null) {
      console.log('✓ Null exit code detected correctly');
      const codeHex = code !== null ? code.toString(16) : 'null';
      console.log('✓ Safe hex conversion:', codeHex);
    } else {
      console.log('Exit code is not null:', code);
      const codeHex = code !== null ? code.toString(16) : 'null';
      console.log('Hex conversion:', codeHex);
    }
  });
  
  // Kill the process after a short delay to simulate the crash scenario
  setTimeout(() => {
    console.log('Killing process to simulate crash...');
    child.kill('SIGKILL');
  }, 100);
}

testNullExitCode();