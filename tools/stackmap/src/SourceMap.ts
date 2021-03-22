import * as fs from 'fs-extra';
import * as path from 'path';
import { SourceMapConsumer, NullableMappedPosition } from 'source-map';

const sourceMappingRE = /^\/\/# sourceMappingURL=([a-zA-Z0-9._\-\/\\]+)$/;

class SourceMap {
  private mConsumers: { [fileName: string]: Promise<SourceMapConsumer | null>} = {};
  private mSourcePath: string;

  constructor(sourcePath: string) {
    this.mSourcePath = sourcePath;
    if ((process.platform === 'win32') && (sourcePath.startsWith('/'))) {
      this.mSourcePath = sourcePath.slice(1);
    }
  }

  public lookup(position: NullableMappedPosition): Promise<NullableMappedPosition> {
    return this.getConsumer(position.source)
    .then(consumer => (consumer === null)
        ? Promise.resolve(position)
        : consumer.originalPositionFor({ line: position.line || 0, column: position.column || 0 }));
  }

  private findSourceMapPath(sourceData: string): string {
    // search for the sourceMappingURL from back to front
    const sourceMappingLine = sourceData
      .split('\n')
      .reverse()
      .find(line => line.match(sourceMappingRE) !== null);
    const match = (sourceMappingLine !== undefined)
      ? sourceMappingLine.match(sourceMappingRE)
      : null;
    return (match !== null)
      ? match[1]
      : '';
  }

  private getConsumer(filePath: string | null): Promise<SourceMapConsumer | null> {
    if (filePath === null) {
      return Promise.resolve(null);
    }

    if (this.mConsumers[filePath] === undefined) {
      const correctedPath = path.join(this.mSourcePath, filePath);
      this.mConsumers[filePath] = fs.readFile(correctedPath, { encoding: 'utf8' })
        .then(data => {
          const sourceMapPath = this.findSourceMapPath(data);
          if (sourceMapPath === undefined) {
            return Promise.reject(null);
          }
          const fullPath: string =
            path.resolve(this.mSourcePath, path.dirname(filePath), path.basename(sourceMapPath));
          console.log('res', sourceMapPath, this.mSourcePath, fullPath);
          return fs.readFile(fullPath, { encoding: 'utf8' });
        })
        .then(data => new SourceMapConsumer(JSON.parse(data)))
        .catch(err => {
          console.error('failed to read sourcemap', err);
          return null;
        });
    }
    return this.mConsumers[filePath];
  }
}

export default SourceMap;
