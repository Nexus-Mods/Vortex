import * as path from "path";

export const VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME = "vortex_override_instructions.json";

export const DEPLOY_BLACKLIST: string[] = [
  path.join("**", ".git", "**", "*"),
  path.join("**", ".gitignore"),
  path.join("**", ".hgignore"),
  path.join("**", ".gitattributes"),
  path.join("**", "meta.ini"),
  path.join("**", "_macosx", "**", "*"),
  path.join("**", "__MACOSX", "**", "*"),
  path.join("**", VORTEX_OVERRIDE_INSTRUCTIONS_FILENAME),
];

export const MIN_VARIANT_NAME = 1;
export const MAX_VARIANT_NAME = 30;

/** id of the notification reporting files a deployment couldn't place */
export const DEPLOYMENT_FAILED_NOTIFICATION_ID = "deployment-failed";

/** id of the notification that a game's deployment method can no longer be used */
export const METHOD_UNAVAILABLE_NOTIFICATION_ID = "deployment-method-unavailable";

/** how many failed files one deployment keeps. */
export const MAX_STORED_DEPLOYMENT_FAILURES = 100;
