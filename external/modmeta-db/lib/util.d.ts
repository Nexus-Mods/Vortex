/// <reference types="bluebird" />
import { IHashResult } from './types';
import * as Promise from 'bluebird';
export declare function genHash(filePath: string): Promise<IHashResult>;
