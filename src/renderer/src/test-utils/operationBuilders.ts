import { DestinationState, OperationKind, type Operation } from "@nexusmods/mod-pipeline";

import { makeNexusFileSource } from "./lockfileBuilders";

type OperationOf<Kind extends Operation["kind"]> = Extract<Operation, { kind: Kind }>;

/** Moves a game file aside where SkyUI's plugin deploys. */
export function makeBackupOperation(
  overrides: Partial<OperationOf<typeof OperationKind.Backup>> = {},
): OperationOf<typeof OperationKind.Backup> {
  return {
    kind: OperationKind.Backup,
    destinationPath: "/fixture-root/game/Data/SkyUI_SE.esp",
    reason: DestinationState.NewOverOther,
    ...overrides,
  };
}

/** Deploys SkyUI's plugin. */
export function makeLinkOperation(
  overrides: Partial<OperationOf<typeof OperationKind.Link>> = {},
): OperationOf<typeof OperationKind.Link> {
  return {
    kind: OperationKind.Link,
    file: makeNexusFileSource(),
    reason: DestinationState.NewFile,
    ...overrides,
  };
}

/** Removes SkyUI's plugin. */
export function makeUnlinkOperation(
  overrides: Partial<OperationOf<typeof OperationKind.Unlink>> = {},
): OperationOf<typeof OperationKind.Unlink> {
  return {
    kind: OperationKind.Unlink,
    file: makeNexusFileSource(),
    reason: DestinationState.Removed,
    ...overrides,
  };
}
