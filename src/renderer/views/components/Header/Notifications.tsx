import { Popover } from "@headlessui/react";
import { mdiBell } from "@mdi/js";
import React from "react";

import { IconButton } from "./IconButton";

export const Notifications = () => (
  <Popover className="relative">
    <Popover.Button as={IconButton} iconPath={mdiBell} title="Notifications" />

    <Popover.Panel className="absolute z-panel">
      Notifications in here
    </Popover.Panel>
  </Popover>
);
