import { VortexModStagingFolder } from "@vortex/shared";
import { expect, test } from "vitest";

import { makeFileChange } from "../../../test-utils/builders";
import { changeToEntry } from "../util/externalChanges";
import { sessionReducer } from "./session";

const MOD_A = VortexModStagingFolder("mod-a");
const MOD_B = VortexModStagingFolder("mod-b");

// two mods' ModInfo.xml, each deleted from its mod's staging folder
const changes = [MOD_A, MOD_B].map((source) =>
  changeToEntry(
    "",
    makeFileChange({ changeType: "srcdeleted", source, filePath: "ModInfo.xml" }),
    new Set(),
  ),
);

test("an action chosen for one mod's file leaves another mod's file at the same path", () => {
  const result = sessionReducer.reducers.SET_EXTERNAL_CHANGE_ACTION(
    { changes },
    { filePaths: ["ModInfo.xml"], action: "import", source: MOD_A },
  );

  expect(result).toMatchObject({
    changes: [
      { source: MOD_A, action: "import" },
      { source: MOD_B, action: "drop" },
    ],
  });
});
