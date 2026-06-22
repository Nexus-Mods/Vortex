import * as _ from "lodash";
import type { IReference } from "modmeta-db";

import type { IDownload } from "../../../extensions/download_management/types/IDownload";
import { lookupFromDownload } from "../../../extensions/mod_management/util/dependencies";
import testModReference from "../../../extensions/mod_management/util/testModReference";

export function testDownloadReference(download: IDownload, reference: IReference): boolean {
  if (download === undefined) {
    return false;
  }

  return testModReference(lookupFromDownload(download), reference);
}
