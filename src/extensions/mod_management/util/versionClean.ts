import * as semver from 'semvish';

function versionClean(input: string): string {
  const res = semver.clean(input);
  return res || '0.0.0-' + input;
}

export default versionClean;
