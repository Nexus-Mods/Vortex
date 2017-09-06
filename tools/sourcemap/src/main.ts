import translate from './translate';

import { command, Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';

interface IParameters {
  source?: string;
  base?: string;
  args: string[];
  help: () => void;
}

function commandLine(): IParameters {
  const version = require(path.join(__dirname, '..', 'package.json')).version;
  return command('sourcemap')
      .usage('-s <SOURCE> [-b <BASE>] <file>')
      .version(version)
      .option('-s, --source <SOURCE>', 'base directory of source files on this system')
      .option(
          '-b, --base <BASE>',
          'base directory of source files in the system where the stack was created')
      .parse(process.argv || []) as any;
}

function main(): Promise<number> {
  const params = commandLine();
  if ((params.args.length === 0)
      || (params.source === undefined)) {
    params.help();
    return Promise.resolve(0);
  }
  return fs.readFile(params.args[0])
      .then(data => translate(params.source, params.base, data.toString()))
      .then(translated => console.log(translated))
      .then(() => 0);
}

main().then(exitCode => process.exit(exitCode));
