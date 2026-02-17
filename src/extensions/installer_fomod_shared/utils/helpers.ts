import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import { hasSessionFOMOD } from "./guards";
import { ProcessCanceled } from "../../../util/CustomErrors";
import type { IChoices, IGroupList } from "../types/interface";

// Helper function to check if there's an active FOMOD dialog
export function hasActiveFomodDialog(api: IExtensionApi): boolean {
  const state = api.getState();
  if (!state || !hasSessionFOMOD(state.session)) {
    return false;
  }

  const activeInstanceId =
    state.session.fomod.installer?.dialog?.activeInstanceId;
  return !!activeInstanceId;
}

export const getChoicesFromState = (
  api: IExtensionApi,
  instanceId: string,
): IChoices => {
  const state = api.getState();
  if (!state || !hasSessionFOMOD(state.session)) {
    throw new ProcessCanceled("FOMOD state missing after installation");
  }

  const dialogState =
    state.session.fomod.installer?.dialog?.instances?.[instanceId]?.state;
  const choices =
    dialogState?.installSteps === undefined
      ? undefined
      : dialogState.installSteps.map((step) => {
          const ofg: IGroupList = step.optionalFileGroups || {
            group: [],
            order: "Explicit",
          };
          return {
            name: step.name,
            groups: (ofg.group || []).map((group) => ({
              name: group.name,
              choices: group.options
                .filter((opt) => opt.selected)
                .map((opt) => ({ name: opt.name, idx: opt.id })),
            })),
          };
        });
  return choices;
};
