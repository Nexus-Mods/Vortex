import SourceMap from './SourceMap';

import * as fs from 'fs-extra';
import * as path from 'path';

const stackRE = /( *at [A-Za-z._\- \[\]]+) \((.*)\)$/;
const sourceRE = /^(.*):([0-9]+):([0-9]+)$/;

function transformLine(sourceMap: SourceMap, input: string): Promise<string> {
  if (input.endsWith('\r')) {
    // damn you windows!
    input = input.slice(0, input.length - 1);
  }

  // is it a line in a stack trace?
  const match = input.match(stackRE);
  if (match === null) {
    return Promise.resolve(input);
  }

  // split up the source into filename:line:column
  const sourceMatch = match[2].match(sourceRE);
  if (sourceMatch === null) {
    return Promise.resolve(input);
  }

  // do the lookup
  const [ source, line, column ] = sourceMatch.slice(1);
  return sourceMap.lookup({
    source,
    line: parseInt(line, 10),
    column: parseInt(column, 10),
  })
    .then(position =>
      // return serialized line
      `${match[1]} (${position.source}:${position.line}:${position.column})`,
    );
}

function translate(sourcePath: string, basePath: string, data: string): Promise<string> {
  const sourceMap = new SourceMap(sourcePath, basePath);

  return Promise.all(data.split('\n')
    .map(line => transformLine(sourceMap, line)))
    .then(lines => lines.join('\n'));
}

export default translate;
