var nbind = require('nbind');
var lib = nbind.init().lib;
setTimeout(() => {
  var sgl = new lib.GamebryoSaveGame(__dirname + '/sample_sse.ess');
  console.log('Name:', sgl.characterName);
  console.log('Level:', sgl.characterLevel);
  console.log('Location:', sgl.location);
  console.log(`screenshotSize: ${sgl.screenshotSize.width}x${sgl.screenshotSize.height}`);
  console.log('plugins:', sgl.plugins);
}, 30);
