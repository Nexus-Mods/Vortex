import * as path from 'path';

export const DEPLOY_BLACKLIST: string[] = [
  path.join('**', '.git', '**', '*'),
  path.join('**', '.gitignore'),
  path.join('**', '.hgignore'),
  path.join('**', '.gitattributes'),
  path.join('**', 'meta.ini'),
  path.join('**', '_macosx', '**', '*'),
];
