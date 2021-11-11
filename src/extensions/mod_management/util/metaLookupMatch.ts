import { ILookupResult } from 'modmeta-db';

function metaLookupMatch(input: ILookupResult[], archiveName: string, gameId: string) {
  const filtered = input.filter(iter => !['revoked', 'unpublished'].includes(iter.value.status));
  if (filtered.length > 0) {
    // for the case where there are multiple matches (same hash, same file size so it's
    // practically guaranteed to be the same file), prefer the one with the exact
    // filename match
    let match = filtered.find(iter => iter.value.fileName === archiveName);
    if (match === undefined) {
      // if there was no exact filename match (user may have renamed the file or it was
      // uploaded to a different site under a different name), prefer the one intended for
      // the managed game
      match = filtered.find(iter => iter.value.gameId === gameId);
    }
    if (match === undefined) {
      // still no match? oof, just take the first match I guess?
      match = filtered[0];
    }

    return match;
  } else {
    return undefined;
  }
}

export default metaLookupMatch;
