import { IExtensionApi } from '../types/IExtensionContext';
import Debouncer from './Debouncer';
import * as fs from './fs';
import getVortexPath from './getVortexPath';
import {log} from './log';

import Promise from 'bluebird';
import { app as appIn, ipcMain, ipcRenderer, remote } from 'electron';
import * as _ from 'lodash';
import {} from 'node-sass';
import * as path from 'path';

const app = appIn || remote.app;

function asarUnpacked(input: string): string {
  return input.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
}

if (ipcMain !== undefined) {
  ipcMain.on('__renderSASS', (evt, stylesheets: string[]) => {
    const sassIndex: string =
      stylesheets.map(name => `@import "${name.replace(/\\/g, '\\\\')}";\n`).join('\n');

    // development builds are always versioned as 0.0.1
    const isDevel: boolean = app.getVersion() === '0.0.1';

    const assetsPath = path.join(getVortexPath('assets_unpacked'), 'css');
    const modulesPath = getVortexPath('modules_unpacked');

    process.env.SASS_BINARY_PATH = path.resolve(getVortexPath('modules'), 'node-sass', 'bin',
      `${process.platform}-${process.arch}-${process.versions.modules}`, 'node-sass.node');
    const sass = require('node-sass');
    sass.render({
      outFile: path.join(assetsPath, 'theme.css'),
      includePaths: [assetsPath, modulesPath],
      data: sassIndex,
      outputStyle: isDevel ? 'expanded' : 'compressed',
    },
      (err, output) => {
        if (err !== null) {
          // the error has its own class and its message is missing relevant information
          evt.sender.send('__renderSASS_result', new Error(err.formatted));
        } else {
          // remove utf8-bom if it's there
          const css = _.isEqual(Array.from(output.css.slice(0, 3)), [0xEF, 0xBB, 0xBF])
            ? output.css.slice(3)
            : output.css;
          evt.sender.send('__renderSASS_result', null, css.toString());
        }
      });

  });
}

class StyleManager {
  private static RENDER_DELAY = 200;
  private mPartials: Array<{ key: string, file: string }>;
  private mRenderDebouncer: Debouncer;
  private mExpectingResult: { resolve: (css: string) => void, reject: (err: Error) => void };

  constructor(api: IExtensionApi) {
    this.mPartials = [
      { key: '__functions',  file: 'functions' },
      { key: '__variables',  file: 'variables' },
      { key: 'variables',    file: undefined },
      { key: '__details',    file: 'details' },
      { key: 'details',      file: undefined },
      { key: '__thirdparty', file: 'thirdparty' },
      { key: '__desktop',    file: 'desktop' },
      { key: '__style',      file: 'style' },
      { key: 'style',        file: undefined },
    ];

    this.mRenderDebouncer = new Debouncer(() => {
      return this.render()
        .catch(err => {
          api.showErrorNotification('Style failed to compile', err, {
            allowReport: false,
          });
        });
    }, StyleManager.RENDER_DELAY);

    ipcRenderer.on('__renderSASS_result', (evt, err: Error, css: string) => {
      if (this.mExpectingResult === undefined) {
        log('warn', 'unexpected sass render result');
        return;
      }

      if (err !== null) {
        this.mExpectingResult.reject(err);
      } else {
        this.mExpectingResult.resolve(css);
      }
      this.mExpectingResult = undefined;
    });
  }

  /**
   * insert or replace a sheet.
   * By default, the sheets "variables", "details" and "style" are intended to customize the
   * look of the application.
   * - "variables" is a set of variables representing colors, sizes and
   *   margins that will be used throughout the application.
   * - "details" applies these variables to different generic controls (like tabs, lists, ...)
   * - "style" is where you should customize individual controls with css rules
   *
   * If your extension sets a sheet that didn't exist before then that sheet will
   * remain with the style and not be touched by anyone else (unless you have a name collision).
   *
   * new sheets will be inserted before the "style" sheet but after everything else. This allows
   * themes to affect extension styles
   *
   * @param {string} key identify the key to set. If this is an existing sheet, that sheet will be
   *                     replaced
   * @param {string} filePath path of the corresponding stylesheet file
   */
  public setSheet(key: string, filePath: string): void {
    log('debug', 'setting stylesheet', { key, filePath });
    try {
      const statProm = (filePath === undefined)
        ? Promise.resolve<void>(undefined)
        : (path.extname(filePath) === '')
        ? Promise.any([fs.statAsync(filePath + '.scss'), fs.statAsync(filePath + '.css')])
            .then(() => null)
        : fs.statAsync(filePath).then(() => null);
      statProm
        .then(() => {
          const idx = this.mPartials.findIndex(partial => partial.key === key);
          if (idx !== -1) {
            this.mPartials[idx] = { key, file: filePath };
          } else {
            this.mPartials.splice(this.mPartials.length - 2, 0, { key, file: filePath });
          }
          this.mRenderDebouncer.schedule(undefined);
        })
        .catch(err => {
          log('warn', 'stylesheet can\'t be read', err.message);
        });
    } catch (err) {
      log('warn', 'stylesheet can\'t be read', { key, path: filePath, err: err.message });
    }
  }

  public renderNow(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.mRenderDebouncer.runNow(err => {
        if (err !== null) {
          return reject(err);
        }
        log('debug', 'style rendered successfully');
        resolve();
      });
    });
  }

  private render(): Promise<void> {
    const stylesheets: string[] = this.mPartials
      .filter(partial => partial.file !== undefined)
      .map(partial => path.isAbsolute(partial.file)
        ? asarUnpacked(partial.file)
        : partial.file);

    return new Promise<void>((resolve, reject) => {
      this.mExpectingResult = { resolve, reject };
      ipcRenderer.send('__renderSASS', stylesheets);
    })
      .then((css: string) => {
        const style = document.createElement('style');
        style.id = 'theme';
        style.type = 'text/css';
        style.innerHTML = css;
        const head = document.getElementsByTagName('head')[0];
        let found = false;
        for (let i = 0; i < head.children.length && !found; ++i) {
          if (head.children.item(i).id === 'theme') {
            head.replaceChild(style, head.children.item(i));
            found = true;
          }
        }
        if (!found) {
          head.appendChild(style);
        }
      });
  }
}

export default StyleManager;
