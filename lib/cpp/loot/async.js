const nbind = require('nbind');
const attachBindings = require('./bindings');

let binding;
try {
  binding = nbind.init(`${__dirname}/loot`);
} catch (err) {
  // only happens during testing from node
  binding = nbind.init();
}

attachBindings(binding);

const lib = binding.lib;

let instance;

process.on('message', event => {
  let result;
  try {
    if (event.type === 'init') {
      instance = new lib.Loot(...event.args);
    } else {
      result = instance[event.type](...event.args);
    }
    process.send({ result });
  } catch (error) {
    process.send({ error: error.message });
  }
});

// signal readiness to process messages
process.send({ result: null });
