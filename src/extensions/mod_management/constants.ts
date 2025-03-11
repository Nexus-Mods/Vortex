import * as path from 'path';

export const VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME = 'vortex_override_instructions.json';

export const DEPLOY_BLACKLIST: string[] = [
  path.join('**', '.git', '**', '*'),
  path.join('**', '.gitignore'),
  path.join('**', '.hgignore'),
  path.join('**', '.gitattributes'),
  path.join('**', 'meta.ini'),
  path.join('**', '_macosx', '**', '*'),
  path.join('**', VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME),
];

export const MIN_VARIANT_NAME = 1;
export const MAX_VARIANT_NAME = 30;
