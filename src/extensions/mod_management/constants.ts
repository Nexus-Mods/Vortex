import * as path from 'path';

export const DEPLOY_BLACKLIST: string[] = [
  path.join('**', '.git', '**', '*'),
  path.join('**', '.gitignore'),
  path.join('**', '.hgignore'),
  path.join('**', '.gitattributes'),
  path.join('**', 'meta.ini'),
  path.join('**', '_macosx', '**', '*'),
];

export const MIN_VARIANT_NAME = 1;
export const MAX_VARIANT_NAME = 30;
