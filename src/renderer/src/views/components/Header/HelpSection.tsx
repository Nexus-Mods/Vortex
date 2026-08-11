import { MenuButton } from "@headlessui/react";
import {
  mdiBugOutline,
  mdiFileDocumentOutline,
  mdiHelpCircleOutline,
  mdiInformationOutline,
  mdiPuzzle,
  mdiThumbsUpDownOutline,
} from "@mdi/js";
import React, { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setDialogVisible } from "../../../actions/session";
import { useExtensionContext } from "../../../ExtensionProvider";
import type { IActionDefinition } from "../../../types/IActionDefinition";
import { Button } from "../../../ui/components/button/Button";
import { Dropdown } from "../../../ui/components/dropdown/Dropdown";
import { DropdownDivider } from "../../../ui/components/dropdown/DropdownDivider";
import { DropdownItem } from "../../../ui/components/dropdown/DropdownItem";
import { DropdownItems } from "../../../ui/components/dropdown/DropdownItems";
import { Tooltip } from "../../../ui/components/tooltip/Tooltip";
import { useGlobalIconActions } from "./useGlobalIconActions";

// Actions from built-in extensions that should render in the main help menu
// with their own icons, rather than under the "extension provided" puzzle section.
const builtInActionIcons: Record<string, string> = {
  feedback: mdiThumbsUpDownOutline,
  bug: mdiBugOutline,
};

export const HelpSection: FC<React.PropsWithChildren<unknown>> = () => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();
  const { t } = useTranslation();

  const handleHelpCentre = useCallback(() => {
    api.events.emit("open-knowledge-base");
  }, [api]);

  const handleDiagnosticFiles = useCallback(() => {
    dispatch(setDialogVisible("diagnostics-files-dialog"));
  }, [dispatch]);

  const handleAbout = useCallback(() => {
    api.events.emit("show-main-page", "About");
  }, [api]);

  const globalIconActions = useGlobalIconActions(extensions);

  const builtInActions = globalIconActions.filter((action) => action.icon in builtInActionIcons);
  const extensionActions = globalIconActions.filter(
    (action) => !(action.icon in builtInActionIcons),
  );

  const handleGlobalIconAction = useCallback((action: IActionDefinition) => {
    return () => {
      if (action.action) {
        action.action([]);
      }
    };
  }, []);

  return (
    <Dropdown>
      {({ open }) => (
        <>
          <Tooltip content={t("Help")} disabled={open} placement="bottom">
            <MenuButton
              appearance="weak"
              aria-label={t("Help")}
              as={Button}
              brand="neutral"
              leftIconPath={mdiHelpCircleOutline}
            />
          </Tooltip>

          <DropdownItems>
            {extensionActions.map((action) => (
              <DropdownItem
                key={`${action.icon}-${action.title}`}
                leftIconPath={mdiPuzzle}
                onClick={handleGlobalIconAction(action)}
              >
                {t(action.title, { ns: action.options?.namespace })}
              </DropdownItem>
            ))}

            {extensionActions.length > 0 && <DropdownDivider />}

            <DropdownItem leftIconPath={mdiHelpCircleOutline} onClick={handleHelpCentre}>
              {t("Help centre")}
            </DropdownItem>

            <DropdownItem leftIconPath={mdiFileDocumentOutline} onClick={handleDiagnosticFiles}>
              {t("View logs")}
            </DropdownItem>

            {builtInActions.map((action) => (
              <DropdownItem
                key={`${action.icon}-${action.title}`}
                leftIconPath={builtInActionIcons[action.icon]}
                onClick={handleGlobalIconAction(action)}
              >
                {t(action.title, { ns: action.options?.namespace })}
              </DropdownItem>
            ))}

            <DropdownItem leftIconPath={mdiInformationOutline} onClick={handleAbout}>
              {t("About")}
            </DropdownItem>
          </DropdownItems>
        </>
      )}
    </Dropdown>
  );
};
