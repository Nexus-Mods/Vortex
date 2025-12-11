/**
 * Button Demo Component
 * Demonstrates the Button component from the web team's "next" project
 */

import * as React from "react";
import { Button } from "./Button";
import { Typography } from "../typography/Typography";

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
    <div className="tw:p-6 tw:space-y-8">
      <Typography
        as="h1"
        typographyType="heading-2xl"
        appearance="strong"
        className="tw:mb-6"
      >
        Button System from Web Team
      </Typography>

      <Typography
        as="p"
        typographyType="body-md"
        appearance="subdued"
        className="tw:mb-8"
      >
        This component is adapted from the web team's "next" project. It
        provides a consistent button system with multiple types, sizes, and
        states. Note: Icon support is pending implementation.
      </Typography>

      {/* Primary Buttons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Primary Buttons
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button buttonType="primary" size="md">
            Primary Medium
          </Button>
          <Button buttonType="primary" size="sm">
            Primary Small
          </Button>
          <Button buttonType="primary" size="md" disabled>
            Disabled
          </Button>
          <Button
            buttonType="primary"
            size="md"
            isLoading={loadingStates.primary}
            onClick={() => handleLoadingClick("primary")}
          >
            Click for Loading
          </Button>
        </div>
      </div>

      {/* Secondary Buttons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Secondary Buttons
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button buttonType="secondary" size="md">
            Secondary Medium
          </Button>
          <Button buttonType="secondary" size="sm">
            Secondary Small
          </Button>
          <Button buttonType="secondary" size="md" filled="strong">
            Filled Strong
          </Button>
          <Button buttonType="secondary" size="md" filled="weak">
            Filled Weak
          </Button>
          <Button buttonType="secondary" size="md" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Tertiary Buttons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Tertiary Buttons
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button buttonType="tertiary" size="md">
            Tertiary Medium
          </Button>
          <Button buttonType="tertiary" size="sm">
            Tertiary Small
          </Button>
          <Button buttonType="tertiary" size="md" filled="strong">
            Filled Strong
          </Button>
          <Button buttonType="tertiary" size="md" filled="weak">
            Filled Weak
          </Button>
        </div>
      </div>

      {/* Success Buttons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Success Buttons
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button buttonType="success" size="md">
            Success Medium
          </Button>
          <Button buttonType="success" size="sm">
            Success Small
          </Button>
          <Button buttonType="success" size="md" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Premium Buttons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Premium Buttons
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button buttonType="premium" size="md">
            Premium Medium
          </Button>
          <Button buttonType="premium" size="sm">
            Premium Small
          </Button>
          <Button buttonType="premium" size="md" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Responsive Buttons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Responsive Buttons
        </Typography>

        <Typography
          as="p"
          typographyType="body-sm"
          appearance="subdued"
          className="tw:mb-4"
        >
          These buttons change size based on screen width. Try resizing the
          window!
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button buttonType="primary" size="sm" isResponsive>
            Responsive (sm on mobile, md on desktop)
          </Button>
        </div>
      </div>

      {/* Link Buttons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Button as Link
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button
            as="link"
            buttonType="primary"
            size="md"
            href="https://nexusmods.com"
            isExternal
          >
            External Link
          </Button>
          <Button as="a" buttonType="secondary" size="md" href="#demo">
            Anchor Link
          </Button>
        </div>
      </div>

      {/* Custom Content */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Custom Content
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button
            buttonType="primary"
            size="md"
            customContent={
              <span className="tw:flex tw:items-center tw:gap-2">
                <span>🎮</span>
                <span>Custom Content Button</span>
              </span>
            }
          />
        </div>
      </div>

      {/* Buttons with Icons */}
      <div className="tw:space-y-4">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Buttons with Icons
        </Typography>

        <div className="tw:flex tw:gap-4 tw:flex-wrap tw:items-center">
          <Button buttonType="primary" size="md" leftIconPath="mdiDownload">
            Download
          </Button>
          <Button
            buttonType="secondary"
            size="md"
            rightIconPath="mdiChevronRight"
          >
            Next
          </Button>
          <Button buttonType="success" size="sm" leftIconPath="mdiCheck">
            Confirm
          </Button>
          <Button buttonType="tertiary" size="md" leftIconPath="mdiCog">
            Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
