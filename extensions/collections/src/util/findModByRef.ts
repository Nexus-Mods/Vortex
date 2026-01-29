import * as _ from "lodash";
import { types, util } from "vortex-api";

export function testDownloadReference(
  download: types.IDownload,
  reference: types.IReference,
): boolean {
  if (download === undefined) {
    return false;
  }

  return util.testModReference(
    (util as any).lookupFromDownload(download),
    reference,
  );
}
