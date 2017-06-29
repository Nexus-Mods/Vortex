import { IIniFormat } from './IIniFormat';
import IniFile from './IniFile';

import * as Promise from 'bluebird';

class IniParser {
  private mFormat: IIniFormat;
  constructor(format: IIniFormat) {
    this.mFormat = format;
  }

  public read<T extends object>(filePath: string): Promise<IniFile<T>> {
    return this.mFormat.read(filePath)
    .then((data: T) => {
      return new IniFile(data);
    });
  }

  public write<T extends object>(filePath: string, file: IniFile<T>): Promise<void> {
    return this.mFormat.write(filePath, file.data, file.changes())
        .then(() => file.apply());
  }
}

export default IniParser;
