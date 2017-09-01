import {ArcGame} from './types';

import * as Promise from 'bluebird';
import { spawn } from 'child_process';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export interface IARCOptions {
  compression?: boolean;
  forceCompression?: boolean;
  game?: ArcGame;
  version?: number;
}

interface IListEntry {
  path: string;
  filenameHash?: number;
  correctExt?: string;
  flags?: number;
  compressedSize?: number;
  realSize?: number;
}

function quote(input: string): string {
  return '"' + input + '"';
}

class ARCWrapper {
  public list(archivePath: string, options?: IARCOptions): Promise<string[]> {
    const outputFile = archivePath + '.verbose.txt';
    let output: string[] = [];
    return this.run('l', [ quote(archivePath) ], options || {})
      .then(() => fs.readFileAsync(outputFile))
      .then(data => {
        output = this.parseList(data.toString()).map(entry => entry.path);
        return fs.unlinkAsync(outputFile);
      })
      .then(() => output);
  }

  public extract(archivePath: string, outputPath: string, options?: IARCOptions): Promise<void> {
    const baseName = path.basename(archivePath, path.extname(archivePath));
    const tempPath = path.join(path.dirname(archivePath), baseName);
    return this.run('x', [ quote(archivePath) ], options || {})
      .then(() => fs.moveAsync(tempPath, outputPath, { overwrite: true }));
  }

  public create(archivePath: string, source: string, options?: IARCOptions): Promise<void> {
    return this.run('c', [ quote(source) ], options || {})
      .then(() => fs.moveAsync(source + '.arc', archivePath, { overwrite: true }));
  }

  private parseList(input: string): IListEntry[] {
    const res = [];
    let current: IListEntry;
    input.split('\n').forEach(line => {
      const arr = line.trim().split('=');
      if (arr.length !== 2) {
        return;
      }
      const [ key, value ] = arr;

      if (key === 'Path') {
        if (current !== undefined) {
          res.push(current);
        }
        current = {
          path: value,
        };
      } else if (current !== undefined) {
        current[key] = value;
      }
    });
    return res;
  }

  private run(command: string, parameters: string[], options: IARCOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let args = [
        '-' + command,
        options.game !== undefined ? '-' + options.game : '-DD',
        '-pc',
        '-noextcorrect',
      ];

      if (options.version !== undefined) {
        args.push('-v');
        args.push(options.version.toFixed());
      }
      args = args.concat(parameters);

      const process = spawn(path.join(__dirname, 'ARCtool.exe'), args, {
        shell: true,
      });

      const errorLines = [];

      process.on('error', (err) => reject(err));

      process.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error('ARCtool.exe failed with status code ' + code));
        }
        // unfortunately ARCtool returns 0 even in error cases
        if (errorLines.length !== 0) {
          return reject(new Error(errorLines.join('\n')));
        }
        return resolve();
      });

      process.stdout.on('data', data => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.startsWith('Error')) {
            errorLines.push(line);
          }
        });
      });
      process.stderr.on('data', data => {
        // ARCTool doesn't use stderr
        data.toString().split('\n').forEach(line => errorLines.push(line));
      });
    });
  }
}

export default ARCWrapper;
