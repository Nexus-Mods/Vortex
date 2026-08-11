import {
  mdiBugOutline,
  mdiFileDocumentOutline,
  mdiHelpCircleOutline,
  mdiInformationOutline,
  mdiPuzzle,
  mdiThumbsUpDownOutline,
} from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setDialogVisible } from "@/actions";
import { useExtensionContext } from "@/ExtensionProvider";
import type { IActionDefinition } from "@/types/IActionDefinition";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/PopoverMenuItem";

import { useGlobalIconActions } from "./useGlobalIconActions";

// Actions from built-in extensions that should render among Vortex's own help rows
// with their own icons, rather than under the "extension provided" puzzle section.
const builtInActionIcons: Record<string, string> = {
  feedback: mdiThumbsUpDownOutline,
  bug: mdiBugOutline,
};

/**
 * The help rows, in two groups: whatever extensions have contributed, then Vortex's
 * own. The first group is empty unless a third-party extension has registered a
 * `global-icons` action, and `PopoverMenu` drops an empty group rather than drawing
 * a rule with nothing under it.
 */
export const useHelpMenuSections = (): IMenuAction[][] => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();
  const { t } = useTranslation();

  const globalIconActions = useGlobalIconActions(extensions);

  const asMenuAction = (action: IActionDefinition, iconPath?: string): IMenuAction => ({
    iconPath,
    label: t(action.title, { ns: action.options?.namespace }),
    onClick: () => action.action?.([]),
  });

  return [
    globalIconActions
      .filter((action) => !(action.icon in builtInActionIcons))
      .map((action) => asMenuAction(action, mdiPuzzle)),

    [
      {
        iconPath: mdiHelpCircleOutline,
        label: t("Help centre"),
        onClick: () => api.events.emit("open-knowledge-base"),
      },
      {
        iconPath: mdiFileDocumentOutline,
        label: t("View logs"),
        onClick: () => dispatch(setDialogVisible("diagnostics-files-dialog")),
      },
      ...globalIconActions
        .filter((action) => action.icon in builtInActionIcons)
        .map((action) => asMenuAction(action, builtInActionIcons[action.icon])),
      {
        iconPath: mdiInformationOutline,
        label: t("About"),
        onClick: () => api.events.emit("show-main-page", "About"),
      },
    ],
  ];
};

/**
 * The same rows as one row that opens them, for nesting inside another menu.
 *
 * `onSelect` gets `dismiss` rather than `close`: picking a help destination ends the
 * interaction, so the menu it was opened from goes away with it.
 */
export const useHelpAction = (): IMenuAction => {
  const { t } = useTranslation();
  const sections = useHelpMenuSections();
  const label = t("Help");

  return {
    iconPath: mdiHelpCircleOutline,
    label,
    panelRole: "menu",
    panel: ({ close, dismiss }) => (
      <PopoverMenu actions={sections} label={label} onClose={close} onSelect={dismiss} />
    ),
  };
};
