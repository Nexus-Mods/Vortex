var nbind = require('nbind')

function savegameBinding () {
	var lib = nbind.init(__dirname).lib
	
	return lib
}
module.exports.savegameBinding = savegameBinding;
