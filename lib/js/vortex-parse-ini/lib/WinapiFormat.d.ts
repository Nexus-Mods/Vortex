/// <reference types="bluebird" />
import { IChanges } from './IChanges';
import { IIniFormat } from './IIniFormat';
import * as Promise from 'bluebird';
declare class WinapiFormat implements IIniFormat {
    private kernel32;
    constructor();
    read(filePath: string): Promise<any>;
    write(filePath: string, data: any, changes: IChanges): Promise<void>;
    private readSectionList(filePath, bufferLength?);
    private readSection(filePath, section, bufferLength?);
}
export default WinapiFormat;
