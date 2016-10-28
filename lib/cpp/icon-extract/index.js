var extractor = require('./build/Release/IconExtractor');

function extractIconToFile(sourceFile, outputFile, callback, width, format) {
  let realWidth;
  if ((width === undefined) || (typeof(width) === 'string')) {
    realWidth = 32;
  } else {
    realWidth = width;
  }
  let realFormat = format || 'png';
  extractor.extractIconToFile(sourceFile, outputFile, realWidth, realFormat, callback);
}

module.exports.extractIconToFile = extractIconToFile;
