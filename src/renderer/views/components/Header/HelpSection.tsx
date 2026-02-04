import { Menu } from "@headlessui/react";
import {
  mdiFileDocumentOutline,
  mdiHelpCircleOutline,
  mdiInformationOutline,
} from "@mdi/js";
import React, { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setDialogVisible } from "../../../../actions/session";
import {
  Dropdown,
  DropdownItem,
  DropdownItems,
} from "../../../../tailwind/components/dropdown";
import { useExtensionContext } from "../../../../util/ExtensionProvider";
import { IconButton } from "./IconButton";

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

  return (
    <Dropdown>
      <Menu.Button
        as={IconButton}
        iconPath={mdiHelpCircleOutline}
        title={t("Help")}
      />

      <DropdownItems>
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
          {t("View Logs")}
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
