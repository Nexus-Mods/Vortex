import { Menu } from "@headlessui/react";
import {
  mdiBug,
  mdiCog,
  mdiHelpCircleOutline,
  mdiInformationOutline,
} from "@mdi/js";
import React, { type FC } from "react";

import {
  Dropdown,
  DropdownItem,
  DropdownItems,
} from "../../../../tailwind/components/dropdown";
import { IconButton } from "./IconButton";

export const HelpSection: FC = () => (
  <Dropdown>
    <Menu.Button as={IconButton} iconPath={mdiHelpCircleOutline} title="Help" />

    <DropdownItems>
      <DropdownItem leftIconPath={mdiCog}>Help centre</DropdownItem>

      <DropdownItem leftIconPath={mdiBug}>Diagnostic files</DropdownItem>

      <DropdownItem leftIconPath={mdiInformationOutline}>About</DropdownItem>
    </DropdownItems>
  </Dropdown>
);
