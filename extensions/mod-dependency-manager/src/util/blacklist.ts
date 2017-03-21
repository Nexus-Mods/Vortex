import minimatch = require('minimatch');

const blacklist = [
  'fomod\\*',
  'readme*',
];

function isBlacklisted(filePath: string): boolean {
  return blacklist.find(pattern => minimatch(filePath, pattern)) !== undefined;
}

export default isBlacklisted;
