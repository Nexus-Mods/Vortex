import { util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

import { healthChecks } from "./diagnostic";
import {
  XREBIRTH_CONTENT_XML_PRIORITY,
  XREBIRTH_GAME_ID,
  XREBIRTH_INSTALLER_SPECS,
  installContentXml,
  testContentXml,
} from "./installers";
import { XREBIRTH_STOP_PATTERNS } from "./stopPatterns";

function main(context: types.IExtensionContext): boolean {
  context.registerGame({
    id: XREBIRTH_GAME_ID,
    name: "X Rebirth",
    queryArgs: { steam: "2870" },
    queryModPath: () => "extensions",
    logo: "gameart.webp",
    executable: () => "XRebirth.exe",
    requiredFiles: ["XRebirth.exe"],
    details: { stopPatterns: XREBIRTH_STOP_PATTERNS },
  });

  // The canonical content.xml installer is hand-written: it parses XML and
  // emits attribute instructions, which the declarative table can't express.
  context.registerInstaller(
    XREBIRTH_GAME_ID,
    XREBIRTH_CONTENT_XML_PRIORITY,
    testContentXml,
    installContentXml,
  );

  // Everything else is a config-driven match → copy → setmodtype.
  util.declareInstallers(context, XREBIRTH_GAME_ID, XREBIRTH_INSTALLER_SPECS);

  for (const check of healthChecks) {
    context.registerHealthCheck(check);
  }

  return true;
}

export default main;
