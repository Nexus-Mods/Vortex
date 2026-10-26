import { getErrorMessageOrDefault } from "@vortex/shared";

import { setDialogVisible } from "@/actions/session";
import { addModRule } from "@/extensions/mod_management/actions/mods";
import type { IExtensionApi, IExtensionContext } from "@/types/IExtensionContext";
import { activeGameId } from "@/util/selectors";
import { batchDispatch } from "@/util/util";

import {
  type IRequirementLinksModalProps,
  RequirementLinksModal,
} from "../../components/requirement_links_modal/RequirementLinksModal";
import { fetchRequirementLinks } from "./fetchRequirementLinks";
import {
  type IRequirementLink,
  makeRequirementRule,
  type RequirementLinkChoice,
} from "./requirementLinks";

/** The action's registered title, which the Mods table's menus place it by. */
export const LINK_REQUIREMENTS_TITLE = "Link Nexus Requirements";

const DIALOG_ID = "link-nexus-requirements";
const NOTIFICATION_ID = "link-nexus-requirements";

/** What the dialog shows, and what its answer does. */
let offer: {
  links: IRequirementLink[];
  answer: (choices: Map<string, RequirementLinkChoice> | undefined) => void;
} = { links: [], answer: () => undefined };

const toArray = (instanceIds: string | string[]) =>
  Array.isArray(instanceIds) ? instanceIds : [instanceIds];

/** Whether any of the mods came from Nexus Mods, so could have requirements listed there. */
function anyFromNexus(api: IExtensionApi, modIds: string[]): boolean {
  const state = api.getState();
  const mods = state.persistent.mods[activeGameId(state)] ?? {};
  return modIds.some((modId) => mods[modId]?.attributes?.source === "nexus");
}

/** Adds the rules the user chose, each to the mod that requires its target. */
function applyChoices(
  api: IExtensionApi,
  links: IRequirementLink[],
  choices: Map<string, RequirementLinkChoice>,
) {
  const state = api.getState();
  const gameId = activeGameId(state);
  const mods = state.persistent.mods[gameId] ?? {};

  const actions = links.flatMap((link) => {
    const choice = choices.get(link.key);
    const target = mods[link.targetModId];
    if (choice === undefined || choice === "skip" || target === undefined) {
      return [];
    }
    return [addModRule(gameId, link.sourceModId, makeRequirementRule(link, target, choice))];
  });

  batchDispatch(api.store, actions);
  if (actions.length > 0) {
    api.sendNotification({
      id: NOTIFICATION_ID,
      type: "success",
      message: "Linked {{count}} requirement(s)",
      replace: { count: actions.length },
      displayMS: 3000,
    });
  }
}

function notifyNothingToLink(api: IExtensionApi, reason: string) {
  api.sendNotification({
    id: NOTIFICATION_ID,
    type: "info",
    title: "No requirements to link",
    message: reason,
    displayMS: 5000,
  });
}

/** Looks up the mods' requirements and, if any can be linked, asks how. */
async function linkRequirements(api: IExtensionApi, modIds: string[]) {
  api.sendNotification({
    id: NOTIFICATION_ID,
    type: "activity",
    message: "Looking up Nexus requirements",
  });

  try {
    const result = await fetchRequirementLinks(api, modIds);
    api.dismissNotification(NOTIFICATION_ID);

    if (result === "logged-out") {
      notifyNothingToLink(api, "Log in to Nexus Mods to look up mod requirements.");
    } else if (result === "no-profile") {
      notifyNothingToLink(api, "No game is being managed.");
    } else if (result.length === 0) {
      notifyNothingToLink(
        api,
        "None of the requirements these mods list on Nexus Mods are installed and unlinked.",
      );
    } else {
      offer = {
        links: result,
        answer: (choices) => {
          // the dialog can close more than once, the offer is answered once
          offer = { ...offer, answer: () => undefined };
          if (choices !== undefined) {
            applyChoices(api, result, choices);
          }
        },
      };
      api.store.dispatch(setDialogVisible(DIALOG_ID));
    }
  } catch (err) {
    api.dismissNotification(NOTIFICATION_ID);
    api.showErrorNotification(
      "Failed to look up Nexus requirements",
      getErrorMessageOrDefault(err),
      {
        allowReport: false,
      },
    );
  }
}

/**
 * "Link Nexus Requirements": turns the requirements selected mods list on Nexus Mods into
 * dependency rules on the installed mods that satisfy them. For one mod in its row menu, and for
 * several in the selection's.
 */
export function registerRequirementLinks(context: IExtensionContext) {
  context.registerDialog(
    DIALOG_ID,
    RequirementLinksModal,
    () =>
      ({
        links: offer.links,
        onAnswer: (choices) => offer.answer(choices),
      }) satisfies Partial<IRequirementLinksModalProps>,
  );

  for (const group of ["mods-action-icons", "mods-multirow-actions"]) {
    context.registerAction(
      group,
      310,
      "connection",
      {},
      LINK_REQUIREMENTS_TITLE,
      (instanceIds: string | string[]) => {
        void linkRequirements(context.api, toArray(instanceIds));
      },
      (instanceIds: string | string[]) => anyFromNexus(context.api, toArray(instanceIds)),
    );
  }
}
