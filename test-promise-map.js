const Promise = require('bluebird');

class ConditionNotMet extends Error {
  constructor() {
    super('condition not met');
  }
}

// Simulate the project structure
const projects = [
  { name: 'project1', condition: 'process.platform === "win32"' },
  { name: 'project2', condition: 'process.platform === "win32"' },
  { name: 'project3', condition: 'process.platform === "darwin"' },
  { name: 'project4', condition: 'process.platform === "darwin"' }
];

function processProject(project) {
  console.log('Processing:', project.name);
  if (project.condition === 'process.platform === "win32"') {
    return Promise.reject(new ConditionNotMet());
  }
  return Promise.resolve();
}

Promise.map(projects, (project) => {
  console.log('Starting project:', project.name);
  return processProject(project)
    .then(() => {
      console.log('Success:', project.name);
    })
    .catch((err) => {
      if (err instanceof ConditionNotMet) {
        console.log('condition wasn\'t met', project.name);
        return Promise.resolve();
      } else {
        console.error('failed', project.name, err);
        return Promise.resolve();
      }
    });
}, { concurrency: 1 })
  .then(() => {
    console.log('All projects processed');
  })
  .catch((err) => {
    console.error('Overall error:', err);
  });