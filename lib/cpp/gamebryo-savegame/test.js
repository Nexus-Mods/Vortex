var nbind = require('nbind')
var lib = nbind.init().lib
setTimeout(() => {
    var sgl = new lib.GamebryoSaveGame(__dirname + '/sample.fos')
    console.log('Character Level:', sgl.characterLevel)
    console.log('Character Location:', sgl.location)
}, 30)
