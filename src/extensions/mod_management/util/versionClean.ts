import * as semver from 'semver';

function versionClean(input: string): string {
  let res = semver.valid(
    semver.coerce(input, { includePrerelease: true })
  );
  if (res !== null) {
    res = semver.clean(res);
  }
  return res || '0.0.0-' + input;
}

export default versionClean;
