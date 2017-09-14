import * as fs from 'fs-extra';
import * as path from 'path';
import { SourceMapConsumer } from 'source-map';

interface IPosition {
  source: string;
  line: number;
  column: number;
}

const sourceMappingRE = /^\/\/# sourceMappingURL=([a-zA-Z0-9._\-\/\\]+)$/;

class SourceMap {
  private mConsumers: { [fileName: string]: Promise<SourceMapConsumer>} = {};
  private mSourcePath: string;
  private mBasePath: string;

  constructor(sourcePath: string, basePath: string) {
    this.mSourcePath = sourcePath;
    this.mBasePath = basePath;
  }

  public lookup(position: IPosition): Promise<IPosition> {
    return this.getConsumer(position.source)
    .then(consumer =>
      (consumer === null)
        ? position
        : consumer.originalPositionFor({ line: position.line, column: position.column }));
  }

  private findSourceMapPath(sourceData: string): string {
    // search for the sourceMappingURL from back to front
    const sourceMappingLine = sourceData
      .split('\n')
      .reverse()
      .find(line => line.match(sourceMappingRE) !== null);
    return (sourceMappingLine !== undefined)
      ? sourceMappingLine.match(sourceMappingRE)[1]
      : undefined;
  }

  private getConsumer(file: string): Promise<SourceMapConsumer> {
    const relPath = this.mBasePath !== undefined
      ? path.relative(this.mBasePath, file)
      : file;

    if (this.mConsumers[relPath] === undefined) {
      const correctedPath = path.join(this.mSourcePath, relPath);
      this.mConsumers[relPath] = fs.readFile(correctedPath)
        .then(data => {
          const sourceMapPath = this.findSourceMapPath(data.toString());
          if (sourceMapPath === undefined) {
            return Promise.reject(null);
          }
          const fullPath: string = (sourceMapPath.startsWith('/'))
            ? this.mSourcePath + sourceMapPath
            : path.resolve(this.mSourcePath, path.dirname(relPath), sourceMapPath);
          return fs.readFile(fullPath);
        })
        .then((data: Buffer) => new SourceMapConsumer(data.toString()))
        .catch(err => {
          if (err !== null) {
            console.error('failed to read sourcemap', err);
          }
          return null;
        });
    }
    return this.mConsumers[relPath];
  }
}

export default SourceMap;
