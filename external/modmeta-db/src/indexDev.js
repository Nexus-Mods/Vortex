require('ts-node/register');
let { ModDB, serveREST } = require('./index.ts');

let db = new ModDB('mods', '.', []);
serveREST(db);
