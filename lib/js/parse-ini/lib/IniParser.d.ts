/// <reference types="bluebird" />
import { IIniFormat } from './IIniFormat';
import IniFile from './IniFile';
import * as Promise from 'bluebird';
declare class IniParser {
    private mFormat;
    constructor(format: IIniFormat);
    read<T>(filePath: string): Promise<IniFile<T>>;
    write<T>(filePath: string, file: IniFile<T>): Promise<void>;
}
export default IniParser;
