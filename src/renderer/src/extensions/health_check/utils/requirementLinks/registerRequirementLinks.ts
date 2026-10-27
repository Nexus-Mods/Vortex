import { getErrorMessageOrDefault } from "@vortex/shared";

import { setDialogVisible } from "@/actions/session";
import {
  addModRule,
  removeModRule,
  setModAttribute,
} from "@/extensions/mod_management/actions/mods";
import type { IExtensionApi, IExtensionContext } from "@/types/IExtensionContext";
import { activeGameId } from "@/util/selectors";
import { batchDispatch } from "@/util/util";

import {
  type IRequirementLinksModalProps,
  RequirementLinksModal,
} from "../../components/requirement_links_modal/RequirementLinksModal";
import { fetchRequirementLinks, type IRequirementLinksOffer } from "./fetchRequirementLinks";
import {
  IGNORED_REQUIREMENTS_ATTRIBUTE,
  ignoredRequirementsOf,
  type IRequirementLink,
  makeRequirementRule,
  type RequirementLinkChoice,
} from "./requirementLinks";

/** The action's registered title, which the Mods table's menus place it by. */
export const LINK_REQUIREMENTS_TITLE = "Link Nexus Requirements";

/** What saving the choices dispatches: rules added and removed, and the ignores kept. */
type LinkAction = ReturnType<typeof addModRule> | ReturnType<typeof setModAttribute>;

const DIALOG_ID = "link-nexus-requirements";
const NOTIFICATION_ID = "link-nexus-requirements";

/** What the dialog shows, and what its answer does. */
let offer: IRequirementLinksOffer & {
  answer: (choices: Map<string, RequirementLinkChoice> | undefined) => void;
} = { links: [], missing: [], answer: () => undefined };

const toArray = (instanceIds: string | string[]) =>
  Array.isArray(instanceIds) ? instanceIds : [instanceIds];

/** Whether any of the mods came from Nexus Mods, so could have requirements listed there. */
function anyFromNexus(api: IExtensionApi, modIds: string[]): boolean {
  const state = api.getState();
  const mods = state.persistent.mods[activeGameId(state)] ?? {};
  return modIds.some((modId) => mods[modId]?.attributes?.source === "nexus");
}

/**
 * Saves what the user changed, on the mod that requires each target: a requirement linked gains
 * its rule, one moved between required and optional has its rule replaced, and one ignored loses
 * its rule, the choice being kept on the mod.
 */
function applyChoices(
  api: IExtensionApi,
  links: IRequirementLink[],
  choices: Map<string, RequirementLinkChoice>,
) {
  const state = api.getState();
  const gameId = activeGameId(state);
  const mods = state.persistent.mods[gameId] ?? {};

  const actions: LinkAction[] = [];
  const ignoredBySource = new Map<string, Set<string>>();
  let changed = 0;
  for (const link of links) {
    const choice = choices.get(link.key);
    const source = mods[link.sourceModId];
    const target = mods[link.targetModId];
    if (choice === undefined || choice === link.current || !source || !target) {
      continue;
    }
    changed += 1;
    if (link.rule !== undefined) {
      actions.push(removeModRule(gameId, source.id, link.rule));
    }
    if (choice !== "ignore") {
      actions.push(addModRule(gameId, source.id, makeRequirementRule(link, target, choice)));
    }
    const ignored = ignoredBySource.get(source.id) ?? new Set(ignoredRequirementsOf(source));
    if (choice === "ignore") {
      ignored.add(link.targetUid);
    } else {
      ignored.delete(link.targetUid);
    }
    ignoredBySource.set(source.id, ignored);
  }
  for (const [modId, ignored] of ignoredBySource) {
    const value = ignored.size > 0 ? [...ignored] : undefined;
    actions.push(setModAttribute(gameId, modId, IGNORED_REQUIREMENTS_ATTRIBUTE, value));
  }

  batchDispatch(api.store, actions);
  if (changed > 0) {
    api.sendNotification({
      id: NOTIFICATION_ID,
      type: "success",
      // the toasts don't fill in `replace`, so the count goes in here
      message: `Saved ${changed} ${changed === 1 ? "change" : "changes"} to requirement links`,
      displayMS: 3000,
    });
  }
}

function notifyNothingToLink(api: IExtensionApi, reason: string) {
  api.sendNotification({
    id: NOTIFICATION_ID,
    type: "info",
    title: "No requirements to show",
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
    } else if (result.links.length === 0 && result.missing.length === 0) {
      notifyNothingToLink(api, "These mods list no requirements on Nexus Mods.");
    } else {
      offer = {
        ...result,
        answer: (choices) => {
          // the dialog can close more than once, the offer is answered once
          offer = { ...offer, answer: () => undefined };
          if (choices !== undefined) {
            applyChoices(api, result.links, choices);
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
        missing: offer.missing,
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
