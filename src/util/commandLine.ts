import * as program from 'commander';
import { app } from 'electron';

export interface IParameters {
  download?: string;
  report?: string;
  restore?: string;
  get?: string;
  set?: string[];
  del?: string;
  run?: string;
  shared?: boolean;
}

function assign(input: string): string[] {
  return input.split('=');
}

function parseCommandline(argv: string[]): IParameters {
  if (!argv[0].includes('electron.exe')) {
    argv = ['dummy'].concat(argv);
  }
  return program
    .command('Vortex')
    .version(app.getVersion())
    .option('-d, --download [url]', 'Start downloadling the specified url.')
    .option('-g, --get [path]', 'Print the state variable at the specified path and quit. '
                              + 'For debugging')
    .option('-s, --set [path]=[value]', 'Change a value in the state. Please be very careful '
                                      + 'with this, incorrect use will break Vortex and you may '
                                      + 'lose data', assign)
    .option('--del [path]', 'Remove a value in state')
    .option('--run [path]', 'Execute the js program instead of Vortex itself.')
    .option('--report [path]', 'Send an error report. For internal use')
    .option('--restore [path]', 'Restore a state backup')
    .option('--shared', 'Used in conjunction with set, get or del, this will access the database'
                                       + 'in the shared location instead of the per-user one')
    // allow unknown options since they may be interpreted by electron/node
    .allowUnknownOption()
    .parse(argv || []) as IParameters;
}

export default parseCommandline;
