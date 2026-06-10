import * as _ from "lodash";

import type * as types from "../../../types/api";
import * as util from "../../../util/api";

export function testDownloadReference(
  download: types.IDownload,
  reference: types.IReference,
): boolean {
  if (download === undefined) {
    return false;
  }

  return util.testModReference((util as any).lookupFromDownload(download), reference);
}
