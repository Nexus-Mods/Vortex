require('ts-node/register');
let { ModDB, serveREST } = require('./index.ts');
let leveldown = require('leveldown');

var program = require('commander');

program
  .version('0.0.1')
  .option('-k, --apikey [type]', 'Specify the api key')
  .parse(process.argv);

if (program.apikey === undefined) {
  console.log('No API Key specified');
  process.exit(1);
}

let db = new ModDB('skyrim', [{
  protocol: 'nexus',
  url: 'https://api.nexusmods.com/v1',
  apiKey: program.apikey,
  cacheDurationSec: 3600,
}], leveldown);

serveREST(db);
