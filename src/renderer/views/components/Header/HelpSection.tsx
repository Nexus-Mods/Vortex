import { Menu } from "@headlessui/react";
import {
  mdiFileDocumentOutline,
  mdiHelpCircleOutline,
  mdiInformationOutline,
} from "@mdi/js";
import React, { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import type { IActionDefinition } from "../../../../types/IActionDefinition";

import { setDialogVisible } from "../../../../actions/session";
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownItems,
} from "../../../../tailwind/components/dropdown";
import { useExtensionContext } from "../../../../util/ExtensionProvider";
import { getIconPath } from "../Menu/iconMap";
import { IconButton } from "./IconButton";
import { useGlobalIconActions } from "./useGlobalIconActions";

export const HelpSection: FC = () => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();
  const { t } = useTranslation();

  const handleHelpCentre = useCallback(() => {
    api.events.emit("show-main-page", "Knowledge Base");
  }, [api]);

  const handleDiagnosticFiles = useCallback(() => {
    dispatch(setDialogVisible("diagnostics-files-dialog"));
  }, [dispatch]);

  const handleAbout = useCallback(() => {
    api.events.emit("show-main-page", "About");
  }, [api]);

  const globalIconActions = useGlobalIconActions(extensions);

  const handleGlobalIconAction = useCallback((action: IActionDefinition) => {
    return () => {
      if (action.action) {
        action.action([]);
      }
    };
  }, []);

  return (
    <Dropdown>
      <Menu.Button
        as={IconButton}
        iconPath={mdiHelpCircleOutline}
        title={t("Help")}
      />

      <DropdownItems>
        {globalIconActions.map((action) => (
          <DropdownItem
            key={`${action.icon}-${action.title}`}
            leftIconPath={getIconPath(action.icon)}
            onClick={handleGlobalIconAction(action)}
          >
            {t(action.title, { ns: action.options?.namespace })}
          </DropdownItem>
        ))}

        {globalIconActions.length > 0 && <DropdownDivider />}

        <DropdownItem
          leftIconPath={mdiHelpCircleOutline}
          onClick={handleHelpCentre}
        >
          {t("Help centre")}
        </DropdownItem>

        <DropdownItem
          leftIconPath={mdiFileDocumentOutline}
          onClick={handleDiagnosticFiles}
        >
          {t("View logs")}
        </DropdownItem>

        <DropdownItem
          leftIconPath={mdiInformationOutline}
          onClick={handleAbout}
        >
          {t("About")}
        </DropdownItem>
      </DropdownItems>
    </Dropdown>
  );
};
