import Promise from 'bluebird';
import _ from 'lodash';
import Debouncer from '../../util/Debouncer';
import { nativeImage } from 'electron';
import * as fs from '../../util/fs';
import path from 'path';
import extractExeIcon from '../../util/exeIcon';
import { ProcessCanceled } from '../../util/CustomErrors';

import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IEditStarterInfo } from './types';

import StarterInfo, { IStarterInfo } from '../../util/StarterInfo';

import { truthy } from '../../util/util';

import lazyRequire from '../../util/lazyRequire';
import * as remoteT from '@electron/remote';
const remote: typeof remoteT = lazyRequire(() => require('@electron/remote'));

export const propOf = <T>(name: keyof T) => name;

export function isEqual(lhs: object, rhs: object) {
  return _.isEqual(lhs, rhs);
}

export function toDirname(filePath: string) {
  return path.dirname(filePath);
}

export function resolveToolName(tool: IStarterInfo | IEditStarterInfo): string {
  return (tool.name)
    ? tool.name
    : tool.exePath
      ? path.basename(tool.exePath, path.extname(tool.exePath))
      : '';
}

export function splitCommandLine(input: string): string[] {
  const res = [];
  let inBrackets = false;
  let startOffset = 0;

  const completeWord = (i) => {
    res.push(input.slice(startOffset, i));
    startOffset = i + 1;
  };

  for (let i = 0; i < input.length; ++i) {
    if ((input[i] === ' ') && (i > startOffset) && !inBrackets) {
      completeWord(i);
    } else if (input[i] === '"') {
      inBrackets = !inBrackets;
    }
  }
  if (input.length > startOffset) {
    completeWord(input.length);
  }

  return res;
}

export function updateJumpList(starters: IStarterInfo[]) {
  if (process.platform !== 'win32') {
    return;
  }
  const userTasks: Electron.Task[] = starters
    .filter(starter =>
      (truthy(starter.exePath))
      && (Object.keys(starter.environment || {}).length === 0))
    .map(starter => {
      const task: Electron.Task = {
        arguments: starter.commandLine.join(' '),
        description: starter.name,
        iconIndex: 0,
        iconPath: StarterInfo.getIconPath(starter),
        program: starter.exePath,
        title: starter.name,
        workingDirectory: starter.workingDirectory,
      };
      return task;
    });
  remote.app.setUserTasks(userTasks);
}

export function toEditStarter(input: IStarterInfo): IEditStarterInfo {
  const temp: any = {
    ...input,
    iconPath: StarterInfo.getIconPath(input),
  };
  temp.commandLine = temp.commandLine.join(' ');
  temp.environment = { ...input.environment };
  return temp;
}

export function toToolDiscovery(tool: IEditStarterInfo): IDiscoveredTool {
  return {
    path: tool.exePath,
    hidden: false,
    custom: true,
    workingDirectory: tool.workingDirectory,
    id: tool.id,
    name: tool.name,
    executable: null,
    requiredFiles: [],
    environment: tool.environment,
    logo: `${tool.id}.png`,
    parameters: splitCommandLine(tool.commandLine),
    shell: tool.shell,
    detach: tool.detach,
    onStart: tool.onStart,
    defaultPrimary: tool.defaultPrimary,
    exclusive: tool.exclusive,
  };
}

function toPNG(inputPath: string, outputPath: string): Promise<void> {
  return fs.writeFileAsync(outputPath, nativeImage.createFromPath(inputPath).toPNG());
}

const updateImageDebouncer = new Debouncer((tool: IStarterInfo, imagePath: string) =>
  useImage(tool, imagePath), 2000);

export function updateImage(tool: IStarterInfo, filePath: string, cb: (err?: Error) => void) {
  updateImageDebouncer.schedule(cb, tool, filePath);
}

function useImage(tool: IStarterInfo, filePath: string): Promise<void> {
  const destPath = tool.iconOutPath;

  if (destPath === filePath) {
    return Promise.resolve();
  }

  return fs.statAsync(filePath)
    .catch(err => Promise.reject(new ProcessCanceled('invalid file')))
    .then(stats => stats.isDirectory()
      ? Promise.reject(new ProcessCanceled('is a directory'))
      : Promise.resolve())
    .then(() => fs.ensureDirAsync(path.dirname(destPath)))
    .then(() => (path.extname(filePath) === '.exe')
      ? extractExeIcon(filePath, destPath)
      : toPNG(filePath, destPath));
}
