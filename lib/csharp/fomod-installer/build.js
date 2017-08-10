var msbuildLib = require('msbuild');
var path = require('path');

var msbuild = new msbuildLib();
msbuild.sourcePath = path.join(__dirname, 'FomodInstaller.sln');

msbuild.configuration = process.argv[2] || 'Release';
msbuild.overrideParams.push('/m'); // parallel build
msbuild.overrideParams.push('/clp:ErrorsOnly');

msbuild.build();
