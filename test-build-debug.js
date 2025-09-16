const Promise = require('bluebird');
const fs = require('fs');

// Load the project groups
const projectGroups = JSON.parse(fs.readFileSync('./BuildSubprojects.json'));

console.log('Total project groups:', projectGroups.length);
console.log('Projects in first group:', projectGroups[0].length);

// Test processing first few projects
const testProjects = projectGroups[0].slice(0, 5); // First 5 projects

console.log('\nTesting first 5 projects:');
testProjects.forEach((project, index) => {
  console.log(`${index + 1}. ${project.name} - condition: ${project.condition || 'none'}`);
});

// Simulate the Promise.map behavior
Promise.map(testProjects, (project) => {
  console.log(`Processing: ${project.name}`);
  
  // Simulate condition check
  if (project.condition === "process.platform === 'win32'") {
    console.log(`  Condition not met for ${project.name} (not Windows)`);
    return Promise.resolve('condition-not-met');
  }
  
  console.log(`  Would process ${project.name}`);
  return Promise.resolve('processed');
}, { concurrency: 1 })
  .then((results) => {
    console.log('\nResults:', results);
    console.log('All projects processed successfully');
  })
  .catch((err) => {
    console.error('Error:', err);
  });