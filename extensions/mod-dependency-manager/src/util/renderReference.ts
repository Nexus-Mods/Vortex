import { IReference } from 'modmeta-db';

function renderReference(ref: IReference) {
  if ((ref.logicalFileName === undefined) && (ref.fileExpression === undefined)) {
    return ref.fileMD5;
  }

  let name = ref.logicalFileName || ref.fileExpression;
  if (ref.versionMatch !== undefined) {
    name += ' v' + ref.versionMatch;
  }
  return name;
}

export default renderReference;
