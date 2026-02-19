/**
 * Dropdown Demo Component
 * Demonstrates the Dropdown component variants and features
 */

import { Menu } from "@headlessui/react";
import {
  mdiContentCopy,
  mdiDelete,
  mdiDotsVertical,
  mdiDownload,
  mdiPencil,
} from "@mdi/js";
import React, { useCallback } from "react";

import { Button } from "../button";
import { Typography } from "../typography";
import { Dropdown } from "./Dropdown";
import { DropdownDivider } from "./DropdownDivider";
import { DropdownItem } from "./DropdownItem";
import { DropdownItems } from "./DropdownItems";

export const DropdownDemo = () => {
  const handleClick = useCallback((label: string) => {
    console.log("Dropdown item clicked:", label);
  }, []);

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Dropdown
        </Typography>

        <Typography appearance="subdued">
          Action menu built on Headless UI. Use Dropdown when items trigger
          actions (e.g. edit, delete, sign out) rather than selecting a value.
          Supports icons, dividers, disabled items, and custom trigger elements.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Basic Dropdown
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Dropdown>
            <Menu.Button as={Button} buttonType="secondary">
              Options
            </Menu.Button>

            <DropdownItems className="right-auto left-0">
              <DropdownItem onClick={() => handleClick("Option 1")}>
                Option 1
              </DropdownItem>

              <DropdownItem onClick={() => handleClick("Option 2")}>
                Option 2
              </DropdownItem>

              <DropdownItem onClick={() => handleClick("Option 3")}>
                Option 3
              </DropdownItem>
            </DropdownItems>
          </Dropdown>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          With Icons and divider
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Dropdown>
            <Menu.Button as={Button} buttonType="secondary">
              Actions
            </Menu.Button>

            <DropdownItems className="right-auto left-0">
              <DropdownItem
                leftIconPath={mdiPencil}
                onClick={() => handleClick("Edit")}
              >
                Edit
              </DropdownItem>

              <DropdownItem
                leftIconPath={mdiContentCopy}
                onClick={() => handleClick("Duplicate")}
              >
                Duplicate
              </DropdownItem>

              <DropdownItem
                leftIconPath={mdiDownload}
                onClick={() => handleClick("Download")}
              >
                Download
              </DropdownItem>

              <DropdownDivider />

              <DropdownItem
                leftIconPath={mdiDelete}
                onClick={() => handleClick("Delete")}
              >
                Delete
              </DropdownItem>
            </DropdownItems>
          </Dropdown>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Icon-only Trigger
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          Using an icon button as the dropdown trigger.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Dropdown>
            <Menu.Button
              as={Button}
              buttonType="secondary"
              leftIconPath={mdiDotsVertical}
              size="sm"
            />

            <DropdownItems className="right-auto left-0">
              <DropdownItem
                leftIconPath={mdiPencil}
                onClick={() => handleClick("Edit")}
              >
                Edit
              </DropdownItem>

              <DropdownItem
                leftIconPath={mdiContentCopy}
                onClick={() => handleClick("Duplicate")}
              >
                Duplicate
              </DropdownItem>

              <DropdownItem
                leftIconPath={mdiDelete}
                onClick={() => handleClick("Delete")}
              >
                Delete
              </DropdownItem>
            </DropdownItems>
          </Dropdown>
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Disabled Items
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Dropdown>
            <Menu.Button as={Button} buttonType="secondary">
              With Disabled
            </Menu.Button>

            <DropdownItems className="right-auto left-0">
              <DropdownItem onClick={() => handleClick("Available")}>
                Available action
              </DropdownItem>

              <DropdownItem disabled={true}>Disabled action</DropdownItem>

              <DropdownItem onClick={() => handleClick("Another")}>
                Another action
              </DropdownItem>
            </DropdownItems>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};
