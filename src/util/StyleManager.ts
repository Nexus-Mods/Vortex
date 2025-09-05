import { IExtensionApi } from '../types/IExtensionContext';
import { getApplication } from './application';
import Debouncer from './Debouncer';
import * as fs from './fs';
import getVortexPath from './getVortexPath';
import {log} from './log';
import { getCurrentPlatform } from './platform';
import { sanitizeCSSId } from './util';

import Promise from 'bluebird';
import { ipcMain, ipcRenderer } from 'electron';
import * as _ from 'lodash';
import * as path from 'path';
import * as sassT from 'sass';
import { pathToFileURL } from 'url';

function asarUnpacked(input: string): string {
  return input.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
}

function cachePath() {
  return path.join(getVortexPath('temp'), 'css-cache.json');
}

if (ipcMain !== undefined) {
  let initial = true;

  const renderSASSCB = (evt: Electron.IpcMainEvent, stylesheets: string[], requested: boolean) => {
    let cache: { stylesheets: string[], css: string };
    if (requested) {
      try {
        // TODO: evil sync read
        cache = JSON.parse(fs.readFileSync(cachePath(), { encoding: 'utf8' }));
        if (_.isEqual(cache.stylesheets, stylesheets)) {
          evt.sender.send('__renderSASS_result', null, cache.css);
          log('debug', 'using cached css', { cached: cache.stylesheets, stylesheets });
          if (requested && initial) {
            initial = false;
            renderSASSCB(evt, stylesheets, false);
          }
          return;
        }
        log('debug', 'updating css cache', {
          cached: cache.stylesheets,
          current: stylesheets,
        });
      } catch (err) {
        log('debug', 'no css cache', { cachePath: cachePath() });
      }
    } else {
      log('debug', 'updating css cache, just to be sure');
    }

    let themePath: string = '.';

    let sassIndex: string =
      stylesheets.map(name => {
        const imp = `@import "${name.replace(/\\/g, '\\\\')}";`;
        // slightly hackish but I think this should work.
        // imports ending in .scss are extensions,
        // imports with no path are the core files.
        // what's left is the imports for the theme.
        // In addition, the style.scss from the theme should be the very last
        // import so even without the condition, the very last item should have
        // the correct path
        if ((path.dirname(name) !== '.') && (path.extname(name) !== '.scss')) {
          themePath = path.dirname(name);
        }
        if (path.extname(name) === '.scss') {
          // nest every extension-provided rule in '*, #added_by_<extname>'
          // this way it's easier to find out where a rule comes from
          // that breaks the layout.
          // the #added_by_ selector should never match anything, * matches
          // everything without modifying the specificity of the selector, so
          // this change shouldn't affect how the rule works
          const extname = sanitizeCSSId(path.basename(name, '.scss'));
          return `*, #added_by_${extname} { ${imp} }\n`;
        } else {
          return imp + '\n';
        }
      }).join('\n');

    sassIndex = `$theme-path: "${pathToFileURL(themePath)}";\n` + sassIndex;

    // development builds are always versioned as 0.0.1
    const isDevel: boolean = (process.env.NODE_ENV === 'development')

    const assetsPath = path.join(getVortexPath('assets_unpacked'), 'css');
    const modulesPath = getVortexPath('modules_unpacked');
    const applicationPath = getVortexPath('application');
    const srcStylesPath = path.join(applicationPath, 'src', 'stylesheets');
    // Add additional paths to handle different relative import patterns
    const rootPath = applicationPath;
    const appPath = path.join(applicationPath, 'app');
    const assetsRootPath = path.join(appPath, 'assets', 'css');
    const assetsBasePath = path.join(appPath, 'assets'); // Add this path for ../../../assets/css resolution

    const replyEvent = requested
      ? '__renderSASS_result'
      : '__renderSASS_update';

    /*
    process.env.SASS_BINARY_PATH = path.resolve(getVortexPath('modules'), 'node-sass', 'bin',
      `${getCurrentPlatform()}-${process.arch}-${process.versions.modules}`, 'node-sass.node');
    */
    const sass: typeof sassT = require('sass');

    setTimeout(() => {
      const started = Date.now();
      sass.render({
        outFile: path.join(assetsPath, 'theme.css'),
        includePaths: [
          assetsPath, 
          modulesPath, 
          srcStylesPath,
          rootPath,           // For resolving paths like '../../src/stylesheets/variables.scss'
          appPath,            // For resolving paths that go through the app directory
          assetsRootPath,     // For resolving paths like '../../../assets/css/variables.scss'
          assetsBasePath      // Additional path for assets resolution
        ],
        data: sassIndex,
        outputStyle: isDevel ? 'expanded' : 'compressed',
      },
                  (err, output) => {
                    log('info', 'sass compiled in', `${Date.now() - started}ms`);
                    if (evt.sender?.isDestroyed()) {
                      return;
                    }
                    if (err !== null) {
            // the error has its own class and its message is missing relevant information
                      evt.sender.send(replyEvent, new Error(err.formatted));
                    } else {
            // remove utf8-bom if it's there
                      const css = _.isEqual(Array.from(output.css.slice(0, 3)), [0xEF, 0xBB, 0xBF])
                        ? output.css.slice(3)
                        : output.css;
                      evt.sender.send(replyEvent, null, css.toString());
                      fs.writeFileAsync(cachePath(), JSON.stringify({
                        stylesheets,
                        css: css.toString(),
                      }), { encoding: 'utf8' })
                        .catch(() => null);
                    }
                  });
    }, requested ? 0 : 2000);
  };

  ipcMain.on('__renderSASS', (evt: Electron.IpcMainEvent, stylesheets: string[]) =>
    renderSASSCB(evt, stylesheets, true));
}

class StyleManager {
  private static RENDER_DELAY = 200;
  private mPartials: Array<{ key: string, file: string }>;
  private mRenderDebouncer: Debouncer;
  private mExpectingResult: { resolve: (css: string) => void, reject: (err: Error) => void };
  private mAutoRefresh: boolean = false;
  private mSetQueue: Promise<void> = Promise.resolve();

  constructor(api: IExtensionApi) {
    // Initialize core stylesheets with full paths to assets directory
    const assetsPath = getVortexPath('assets_unpacked');
    log('debug', 'StyleManager constructor - initializing core stylesheets with assets path', {
      assetsPath
    });
    
    this.mPartials = [
      { key: '__functions',  file: path.join(assetsPath, 'css', 'functions.scss') },
      { key: '__variables',  file: path.join(assetsPath, 'css', 'variables.scss') },
      { key: 'variables',    file: undefined },
      { key: '__details',    file: path.join(assetsPath, 'css', 'details.scss') },
      { key: 'details',      file: undefined },
      { key: '__thirdparty', file: path.join(assetsPath, 'css', 'thirdparty.scss') },
      { key: '__desktop',    file: path.join(assetsPath, 'css', 'desktop.scss') },
      { key: '__style',      file: path.join(assetsPath, 'css', 'style.scss') },
      { key: 'style',        file: undefined },
    ];
    
    log('debug', 'StyleManager constructor - initialized mPartials with full paths', {
      partials: this.mPartials
    });
    
    log('debug', 'StyleManager initialized with partials', { 
      partials: this.mPartials,
      assetsPath: getVortexPath('assets_unpacked')
    });
  
    this.mRenderDebouncer = new Debouncer(() => {
      return this.render()
        .catch(err => {
          api.showErrorNotification('Style failed to compile', err, {
            allowReport: false,
          });
        });
    }, StyleManager.RENDER_DELAY, true);

    ipcRenderer.on('__renderSASS_result', (evt, err: Error, css: string) => {
      log('debug', 'StyleManager IPC __renderSASS_result - received SASS compilation result', { 
        hasError: !!err,
        errorMessage: err?.message,
        cssLength: css?.length || 0,
        cssPreview: css?.substring(0, 100) || 'empty',
        expectingResult: !!this.mExpectingResult
      });
      
      if (this.mExpectingResult === undefined) {
        log('warn', 'StyleManager IPC __renderSASS_result - unexpected sass render result, no pending promise');
        return;
      }

      if (err !== null) {
        log('error', 'StyleManager IPC __renderSASS_result - SASS compilation failed', {
          error: err.message,
          stack: err.stack
        });
        this.mExpectingResult.reject(err);
      } else {
        log('debug', 'StyleManager IPC __renderSASS_result - SASS compilation successful, resolving promise');
        this.mExpectingResult.resolve(css);
      }
      this.mExpectingResult = undefined;
    });

    ipcRenderer.on('__renderSASS_update', (evt, err: Error, css: string) => {
      log('debug', 'StyleManager IPC __renderSASS_update - received SASS update', { 
        hasError: !!err,
        errorMessage: err?.message,
        cssLength: css?.length || 0,
        cssPreview: css?.substring(0, 100) || 'empty'
      });
      
      if (err !== null) {
        // logging as warning because we don't know if this will be a problem
        // but it may lead to a messed up look
        log('warn', 'StyleManager IPC __renderSASS_update - css render failed', {
          error: err.message,
          stack: err.stack
        });
      } else {
        log('debug', 'StyleManager IPC __renderSASS_update - applying updated CSS');
        this.applyCSS(css);
      }
    });
  }

  public startAutoUpdate() {
    this.mAutoRefresh = true;
  }

  public clearCache(): void {
    this.mSetQueue = this.mSetQueue.then(() =>
      fs.removeAsync(cachePath())
        .catch({ code: 'ENOENT' }, () => null)
        .catch(err => log('error', 'failed to remove css cache', {error: err.message})));
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
    log('debug', 'StyleManager setSheet - setting stylesheet', { 
      key, 
      filePath,
      isAbsolute: path.isAbsolute(filePath || ''),
      extension: path.extname(filePath || ''),
      currentPartials: this.mPartials.length
    });
    try {
      const statProm = () => (filePath === undefined)
        ? Promise.resolve<void>(undefined)
        : (path.extname(filePath) === '')
          ? Promise.any([fs.statAsync(filePath + '.scss'), fs.statAsync(filePath + '.css')])
            .then(() => null)
          : fs.statAsync(filePath).then(() => null);
      this.mSetQueue = this.mSetQueue
        .then(() => statProm())
        .then(() => {
          const idx = this.mPartials.findIndex(partial => partial.key === key);
          const oldPartial = idx !== -1 ? this.mPartials[idx] : null;
          
          if (idx !== -1) {
            this.mPartials[idx] = { key, file: filePath };
            log('debug', 'StyleManager setSheet - replaced existing partial', {
              key,
              oldFile: oldPartial?.file,
              newFile: filePath,
              index: idx
            });
          } else {
            this.mPartials.splice(this.mPartials.length - 2, 0, { key, file: filePath });
            log('debug', 'StyleManager setSheet - added new partial', {
              key,
              filePath,
              insertIndex: this.mPartials.length - 3,
              totalPartials: this.mPartials.length
            });
          }
          
          log('debug', 'StyleManager setSheet - updated partials array', {
            allPartials: this.mPartials,
            autoRefresh: this.mAutoRefresh
          });
          
          if (this.mAutoRefresh) {
            this.mRenderDebouncer.schedule(undefined);
            log('debug', 'StyleManager setSheet - scheduled render due to auto refresh');
          }
        })
        .catch(err => {
          log('warn', 'StyleManager setSheet - stylesheet can\'t be read', {
            key,
            filePath,
            error: err.message
          });
        });
    } catch (err) {
      log('warn', 'StyleManager setSheet - exception during setSheet', { 
        key, 
        path: filePath, 
        err: err.message 
      });
    }
  }

  public renderNow(): Promise<void> {
    this.mSetQueue = this.mSetQueue.then(() => new Promise<void>((resolve, reject) => {
      this.mRenderDebouncer.runNow(err => {
        if (err !== null) {
          return reject(err);
        }
        resolve();
      });
    }));
    return this.mSetQueue;
  }

  private render(): Promise<void> {
    const filteredPartials = this.mPartials.filter(partial => partial.file !== undefined);
    const stylesheets: string[] = filteredPartials
      .map(partial => path.isAbsolute(partial.file)
        ? asarUnpacked(partial.file)
        : partial.file);

    log('debug', 'StyleManager render - processing stylesheets', {
      allPartials: this.mPartials,
      filteredPartials: filteredPartials,
      finalStylesheets: stylesheets,
      excludedPartials: this.mPartials.filter(partial => partial.file === undefined)
    });

    return new Promise<string>((resolve, reject) => {
      this.mExpectingResult = { resolve, reject };
      ipcRenderer.send('__renderSASS', stylesheets);
    })
      .then((css: string) => {
        log('debug', 'StyleManager render - received CSS', {
          cssLength: css?.length || 0,
          cssPreview: css?.substring(0, 200) || 'empty'
        });
        this.applyCSS(css);
      });
  }

  private applyCSS(css: string) {
    const style = document.createElement('style');
    style.id = 'theme';
    style.type = 'text/css';
    style.innerHTML = css;
    const head = document.getElementsByTagName('head')[0];
    let found = false;
    
    log('debug', 'StyleManager applyCSS - injecting CSS', {
      cssLength: css?.length || 0,
      cssContent: css || 'empty',
      existingThemeElements: Array.from(head.children).filter(el => el.id === 'theme').length
    });
    
    for (let i = 0; i < head.children.length && !found; ++i) {
      if (head.children.item(i).id === 'theme') {
        head.replaceChild(style, head.children.item(i));
        found = true;
        log('debug', 'StyleManager applyCSS - replaced existing theme element');
      }
    }
    if (!found) {
      head.appendChild(style);
      log('debug', 'StyleManager applyCSS - appended new theme element');
    }
    
    // Verify injection
    const injectedElement = document.getElementById('theme');
    log('debug', 'StyleManager applyCSS - verification', {
      elementExists: !!injectedElement,
      elementContent: injectedElement?.innerHTML?.substring(0, 200) || 'none',
      totalHeadChildren: head.children.length
    });
  }
}

export default StyleManager;
