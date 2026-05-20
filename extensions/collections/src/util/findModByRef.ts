import { types, util } from "@nexusmods/vortex-api";
import * as _ from "lodash";

export function testDownloadReference(
  download: types.IDownload,
  reference: types.IReference,
): boolean {
  if (download === undefined) {
    return false;
  }

  return util.testModReference((util as any).lookupFromDownload(download), reference);
}
