/**
 * Button Demo Component
 * Demonstrates the Button component from the web team's "next" project
 */

import { mdiCheck, mdiChevronRight, mdiCog, mdiDownload } from "@mdi/js";
import * as React from "react";

import { Typography } from "../typography/Typography";
import { Button } from "./Button";

export const ButtonDemo: React.ComponentType = () => {
  const [loadingStates, setLoadingStates] = React.useState<
    Record<string, boolean>
  >({});

  const handleLoadingClick = (key: string) => {
    setLoadingStates({ ...loadingStates, [key]: true });
    setTimeout(() => {
      setLoadingStates({ ...loadingStates, [key]: false });
    }, 2000);
  };

  return (
    <div className="space-y-8 p-6">
      <Typography
        appearance="strong"
        as="h1"
        className="mb-6"
        typographyType="heading-2xl"
      >
        Button System from Web Team
      </Typography>

      <Typography
        appearance="subdued"
        as="p"
        className="mb-8"
        typographyType="body-md"
      >
        This component is adapted from the web team's "next" project. It
        provides a consistent button system with multiple types, sizes, and
        states. Note: Icon support is pending implementation.
      </Typography>

      {/* Primary Buttons */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Primary Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="primary" size="md">
            Primary Medium
          </Button>

          <Button buttonType="primary" size="sm">
            Primary Small
          </Button>

          <Button buttonType="primary" disabled={true} size="md">
            Disabled
          </Button>

          <Button
            buttonType="primary"
            isLoading={loadingStates.primary}
            size="md"
            onClick={() => handleLoadingClick("primary")}
          >
            Click for Loading
          </Button>
        </div>
      </div>

      {/* Secondary Buttons */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Secondary Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="secondary" size="md">
            Secondary Medium
          </Button>

          <Button buttonType="secondary" size="sm">
            Secondary Small
          </Button>

          <Button buttonType="secondary" filled="strong" size="md">
            Filled Strong
          </Button>

          <Button buttonType="secondary" filled="weak" size="md">
            Filled Weak
          </Button>

          <Button buttonType="secondary" disabled={true} size="md">
            Disabled
          </Button>
        </div>
      </div>

      {/* Tertiary Buttons */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Tertiary Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="tertiary" size="md">
            Tertiary Medium
          </Button>

          <Button buttonType="tertiary" size="sm">
            Tertiary Small
          </Button>

          <Button buttonType="tertiary" filled="strong" size="md">
            Filled Strong
          </Button>

          <Button buttonType="tertiary" filled="weak" size="md">
            Filled Weak
          </Button>
        </div>
      </div>

      {/* Success Buttons */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Success Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="success" size="md">
            Success Medium
          </Button>

          <Button buttonType="success" size="sm">
            Success Small
          </Button>

          <Button buttonType="success" disabled={true} size="md">
            Disabled
          </Button>
        </div>
      </div>

      {/* Premium Buttons */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Premium Buttons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="premium" size="md">
            Premium Medium
          </Button>

          <Button buttonType="premium" size="sm">
            Premium Small
          </Button>

          <Button buttonType="premium" disabled={true} size="md">
            Disabled
          </Button>
        </div>
      </div>

      {/* Responsive Buttons */}
      <div className="space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="mb-4"
        >
          Responsive Buttons
        </Typography>

        <Typography
          as="p"
          typographyType="body-sm"
          appearance="subdued"
          className="mb-4"
        >
          These buttons change size based on screen width. Try resizing the
          window!
        </Typography>

        <div className="flex gap-4 flex-wrap items-center">
          <Button buttonType="primary" size="sm">
            Responsive (sm on mobile, md on desktop)
          </Button>
        </div>
      </div>

      {/* Link Buttons */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Button as Link
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            as="link"
            buttonType="primary"
            href="https://nexusmods.com"
            isExternal={true}
            size="md"
          >
            External Link
          </Button>

          <Button as="a" buttonType="secondary" href="#demo" size="md">
            Anchor Link
          </Button>
        </div>
      </div>

      {/* Custom Content */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Custom Content
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            buttonType="primary"
            customContent={
              <span className="flex items-center gap-2">
                <span>🎮</span>

                <span>Custom Content Button</span>
              </span>
            }
            size="md"
          />
        </div>
      </div>

      {/* Buttons with Icons */}
      <div className="space-y-4">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Buttons with Icons
        </Typography>

        <div className="flex flex-wrap items-center gap-4">
          <Button buttonType="primary" leftIconPath={mdiDownload} size="md">
            Download
          </Button>

          <Button
            buttonType="secondary"
            rightIconPath={mdiChevronRight}
            size="md"
          >
            Next
          </Button>

          <Button buttonType="success" leftIconPath={mdiCheck} size="sm">
            Confirm
          </Button>

          <Button buttonType="tertiary" leftIconPath={mdiCog} size="md">
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
