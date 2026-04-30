import { util } from "vortex-api";
import type { ICollectionModRule } from "../types/ICollection";

/**
 * hook to fix up collection rules to maintain a bit of backwards compatibility for older
 * collections.
 * Should be cleared when we do a stable release
 */
export function postProcessRule(rule: ICollectionModRule): ICollectionModRule {
  const result = JSON.parse(JSON.stringify(rule));
  // remove fileExpression from references with fuzzy version when there's already a
  // logicalFileName, because the fileExpressions we stored are simply the file name and that
  // won't match newer versions.
  // this is handled differently compared to md5 hash which we keep but ignore it testModReference
  // because with an md5 hash it's generally the case it will only match one version whereas
  // fileExpression supports matching multiple versions, it's simply that we have no automated
  // way of generating glob patterns that ignore the version and date field in the file names
  if (
    util.isFuzzyVersion(result.reference.versionMatch) &&
    !!result.reference.logicalFileName
  ) {
    delete result.reference.fileExpression;
  }
  if (
    util.isFuzzyVersion(result.source.versionMatch) &&
    !!result.source.logicalFileName
  ) {
    delete result.source.fileExpression;
  }
  return result;
}
