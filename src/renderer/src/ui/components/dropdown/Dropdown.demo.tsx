/**
 * Dropdown Demo Component
 * Demonstrates the Dropdown component variants and features
 */

import { MenuButton } from "@headlessui/react";
import {
  mdiCheckCircleOutline,
  mdiContentCopy,
  mdiDelete,
  mdiDotsVertical,
  mdiDownload,
  mdiPencil,
  mdiRocketLaunchOutline,
  mdiStarOutline,
} from "@mdi/js";
import React, { useCallback } from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

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
          Action menu built on Headless UI. Use Dropdown when items trigger actions (e.g. edit,
          delete, sign out) rather than selecting a value. Supports icons, dividers, disabled items,
          and custom trigger elements.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Basic Dropdown
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Dropdown>
            <MenuButton as={Button} brand="neutral" appearance="subdued">
              Options
            </MenuButton>

            <DropdownItems className="right-auto left-0">
              <DropdownItem onClick={() => handleClick("Option 1")}>Option 1</DropdownItem>

              <DropdownItem onClick={() => handleClick("Option 2")}>Option 2</DropdownItem>

              <DropdownItem onClick={() => handleClick("Option 3")}>Option 3</DropdownItem>
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
            <MenuButton as={Button} brand="neutral" appearance="subdued">
              Actions
            </MenuButton>

            <DropdownItems className="right-auto left-0">
              <DropdownItem leftIconPath={mdiPencil} onClick={() => handleClick("Edit")}>
                Edit
              </DropdownItem>

              <DropdownItem leftIconPath={mdiContentCopy} onClick={() => handleClick("Duplicate")}>
                Duplicate
              </DropdownItem>

              <DropdownItem leftIconPath={mdiDownload} onClick={() => handleClick("Download")}>
                Download
              </DropdownItem>

              <DropdownDivider />

              <DropdownItem
                brand="danger"
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
          Branded rows
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          A row takes the same brands a Button does. Only the icon is tinted — the labels stay one
          even column of text to read down. neutral is the default, so it tints nothing. danger is
          the exception, colouring the whole row: a destructive action should be the one thing in a
          menu that is hard to pick by accident.
        </Typography>

        <div className="flex flex-wrap gap-4">
          <Dropdown>
            <MenuButton as={Button} brand="neutral" appearance="subdued">
              Brands
            </MenuButton>

            <DropdownItems className="right-auto left-0">
              <DropdownItem
                brand="primary"
                leftIconPath={mdiRocketLaunchOutline}
                onClick={() => handleClick("Deploy")}
              >
                Deploy
              </DropdownItem>

              <DropdownItem
                brand="info"
                leftIconPath={mdiDownload}
                onClick={() => handleClick("Check for updates")}
              >
                Check for updates
              </DropdownItem>

              <DropdownItem
                brand="success"
                leftIconPath={mdiCheckCircleOutline}
                onClick={() => handleClick("Verify")}
              >
                Verify
              </DropdownItem>

              <DropdownItem
                brand="premium"
                leftIconPath={mdiStarOutline}
                onClick={() => handleClick("Go premium")}
              >
                Go premium
              </DropdownItem>

              <DropdownItem leftIconPath={mdiPencil} onClick={() => handleClick("Rename")}>
                Rename
              </DropdownItem>

              <DropdownDivider />

              <DropdownItem
                brand="danger"
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
            <MenuButton
              as={Button}
              brand="neutral"
              appearance="subdued"
              leftIconPath={mdiDotsVertical}
              size="sm"
            />

            <DropdownItems className="right-auto left-0">
              <DropdownItem leftIconPath={mdiPencil} onClick={() => handleClick("Edit")}>
                Edit
              </DropdownItem>

              <DropdownItem leftIconPath={mdiContentCopy} onClick={() => handleClick("Duplicate")}>
                Duplicate
              </DropdownItem>

              <DropdownItem leftIconPath={mdiDelete} onClick={() => handleClick("Delete")}>
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
            <MenuButton as={Button} brand="neutral" appearance="subdued">
              With Disabled
            </MenuButton>

            <DropdownItems className="right-auto left-0">
              <DropdownItem onClick={() => handleClick("Available")}>Available action</DropdownItem>

              <DropdownItem disabled={true}>Disabled action</DropdownItem>

              <DropdownItem onClick={() => handleClick("Another")}>Another action</DropdownItem>
            </DropdownItems>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};
