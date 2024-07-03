import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/api';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { ParserError } from '../announcement_dashlet/types';

import path from 'path';
import url from 'url';
import https from 'https';

import { IMOTMEntry, IMOTMEntryExt } from './types';
import ModsOfTheMonthDashlet from './ModsOfTheMonthDashlet';

const MODS_OF_THE_MONTH_LINK =
  'https://raw.githubusercontent.com/Nexus-Mods/Vortex-Backend/main/out/modsofthemonth.json';

const YOUTUBE_EMBED_URL = `https://www.youtube.com/embed/`;
const YOUTUBE_OPTS = `enablejsapi=1&origin=vortex.app&widget_referrer=vortex.app`;

// Can be used for debugging.
const DEBUG_MODE: boolean = false;
const MOTM_LOCAL_PATH = path.join(__dirname, 'modsofthemonth.json');

function readLocalFile() {
  return fs.readFileAsync(MOTM_LOCAL_PATH)
    .then(data => {
      try {
        const parsed: IMOTMEntry[] = JSON.parse(data);
        return Promise.resolve(parsed);
      } catch (err) {
        return Promise.reject(err);
      }
    });
}

function getHTTPData<T>(link: string): Promise<T[]> {
  const sanitizedURL = url.parse(link);
  log('info', 'getHTTPData', sanitizedURL);
  return new Promise((resolve, reject) => {
    https.get(sanitizedURL.href, res => {
      res.setEncoding('utf-8');
      let output = '';
      res
        .on('data', (data) => output += data)
        .on('end', () => {
          try {
            const parsed: T[] = JSON.parse(output);
            resolve(parsed);
          } catch (err) {
            reject(new ParserError(res.statusCode, err.message, link, output));
          }
        });
    }).on('error', (e) => {
      reject(e);
    }).end();
  });
}


function decorateData(data: IMOTMEntry[]): IMOTMEntryExt[] {
  const decorated: IMOTMEntryExt[] = [];
  for (const entry of data) {
    const parsed = new Date(entry.date * 1000);
    decorated.push({
      ...entry,
      month: parsed.toLocaleString('default', { month: 'long' }),
      year: parsed.toLocaleString('default', { year: 'numeric' }),
      link: `${YOUTUBE_EMBED_URL}${entry.videoid}?${YOUTUBE_OPTS}`
    });
  }
  return decorated;
}

async function updateMOTM(): Promise<IMOTMEntry[]> {
  try {
    let res: IMOTMEntry[];
    if (DEBUG_MODE) {
      res = await readLocalFile();
    }
    if (res === undefined) {
      res = await getHTTPData<IMOTMEntry>(MODS_OF_THE_MONTH_LINK);
    }
    res.sort((a, b) => a.date - b.date);
    return decorateData(res);
  } catch (err) {
    log('warn', 'failed to retrieve mods of the month data', err);
    return Promise.resolve([]);
  }
}

function init(context: IExtensionContext): boolean {
  context.registerDashlet('Mods of the Month', 1, 3, 2, ModsOfTheMonthDashlet, (state: IState) => true, () => ({
    update: () => updateMOTM(),
  }), {
    fixed: false,
    closable: true,
  });  
  
  return true;
}

export default init;