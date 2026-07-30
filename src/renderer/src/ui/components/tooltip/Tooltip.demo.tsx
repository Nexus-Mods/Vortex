/**
 * Tooltip Demo Component
 * Demonstrates rich content, collision handling near the window edges, and delay grouping
 */

import {
  mdiAlertCircleOutline,
  mdiCheckCircleOutline,
  mdiFolderOpenOutline,
  mdiHistory,
  mdiOpenInNew,
  mdiRefresh,
  mdiTune,
} from "@mdi/js";
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Pill } from "@/ui/components/pill/Pill";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";

import { Tooltip } from "./Tooltip";
import { TooltipDelayGroup } from "./TooltipDelayGroup";

const toolbarActions = [
  { iconPath: mdiFolderOpenOutline, label: "Open mods folder" },
  { iconPath: mdiHistory, label: "Deployment history" },
  { iconPath: mdiRefresh, label: "Rescan mods" },
  { iconPath: mdiTune, label: "Display options" },
];

/** Rich body: a heading, supporting copy, and a status list. */
const ModHealthContent = () => (
  <div className="space-y-2 p-3">
    <Typography as="h4" typographyType="title-xs">
      Unofficial Skyrim Patch
    </Typography>

    <Typography appearance="subdued" typographyType="body-sm">
      Version 4.2.9b — installed 3 days ago. Two requirements resolved automatically.
    </Typography>

    <div className="space-y-1">
      <div className="flex items-center gap-x-2">
        <Icon className="text-success-strong" path={mdiCheckCircleOutline} size="xs" />

        <Typography typographyType="body-sm">SKSE64 detected</Typography>
      </div>

      <div className="flex items-center gap-x-2">
        <Icon className="text-warning-strong" path={mdiAlertCircleOutline} size="xs" />

        <Typography typographyType="body-sm">Load order not yet sorted</Typography>
      </div>
    </div>
  </div>
);

export const TooltipDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Tooltip
      </Typography>

      <Typography appearance="subdued">
        A collision-aware tooltip built on Floating UI. Content is arbitrary React, so it holds
        headings, lists and icons rather than just a string. Position is resolved against the window
        continuously: it flips to the opposite side when the preferred one would overflow, slides
        along an edge when a corner would, and clamps its width and height to the space left. It
        renders into the overlay host, so it escapes the `overflow: hidden` of tables and scroll
        panes.
      </Typography>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Plain and rich content
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        Pass a string for a simple label, or any node for a rich one. Both use the same component.
      </Typography>

      <div className="flex flex-wrap items-center gap-4">
        <Tooltip content="Deploys every enabled mod to the game folder">
          <Button>Deploy</Button>
        </Tooltip>

        <Tooltip customContent={<ModHealthContent />}>
          <Button appearance="subdued" brand="neutral">
            Rich content
          </Button>
        </Tooltip>

        <Tooltip content="Wraps at the 320px cap set on .nxm-tooltip instead of stretching into one long line that runs the full width of the window and becomes unreadable.">
          <Button appearance="subdued" brand="neutral">
            Long text
          </Button>
        </Tooltip>

        <Tooltip
          className="max-w-lg"
          content="Widened with a max-w-lg utility class rather than a prop. The positioner still clamps to the window, so a wider cap cannot push it off an edge."
        >
          <Button appearance="subdued" brand="neutral">
            Wider cap
          </Button>
        </Tooltip>

        <Tooltip disabled content="Never shown">
          <Button appearance="weak" brand="neutral">
            Disabled tooltip
          </Button>
        </Tooltip>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Triggers that do not forward a ref
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        The trigger has to hand a DOM node to the tooltip. `Button` forwards its ref, but plenty of
        components (`Icon`, `Pill`) and bare text do not — wrap those in a `span`.
      </Typography>

      <div className="flex flex-wrap items-center gap-4">
        <Tooltip content="Two of this mod's requirements are not installed yet" placement="right">
          <span className="inline-flex">
            <Icon className="text-warning-strong" path={mdiAlertCircleOutline} size="sm" />
          </span>
        </Tooltip>

        <Tooltip content="Hidden from the mod list until its game is managed">
          <span className="inline-flex">
            <Pill>Pill trigger</Pill>
          </span>
        </Tooltip>

        <Tooltip content="Any element works — this one is a plain span of text">
          <span className="underline decoration-dotted">Inline text</span>
        </Tooltip>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Placement
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        The placement you set is a preference, not a guarantee — it is the starting point the
        collision middleware works from.
      </Typography>

      <div className="flex flex-wrap items-center gap-4">
        <Tooltip content="Placed above" placement="top">
          <Button appearance="subdued" brand="neutral">
            Top
          </Button>
        </Tooltip>

        <Tooltip content="Placed to the right" placement="right">
          <Button appearance="subdued" brand="neutral">
            Right
          </Button>
        </Tooltip>

        <Tooltip content="Placed below" placement="bottom">
          <Button appearance="subdued" brand="neutral">
            Bottom
          </Button>
        </Tooltip>

        <Tooltip content="Placed to the left" placement="left">
          <Button appearance="subdued" brand="neutral">
            Left
          </Button>
        </Tooltip>

        <Tooltip content="No arrow, tighter against the trigger" showArrow={false}>
          <Button appearance="subdued" brand="neutral">
            No arrow
          </Button>
        </Tooltip>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Collision handling
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        Every trigger below asks for the one placement that cannot fit. The left and right ones ask
        to be placed outward and get slid back inside instead. Scroll this page so the row sits near
        the top or bottom of the window and the top/bottom ones flip to the opposite side.
      </Typography>

      <div className="flex items-center justify-between gap-4">
        <Tooltip
          content="Asked for left placement with no room to the left, so it slides back into view rather than off the edge."
          placement="left"
        >
          <Button appearance="subdued" brand="neutral">
            Left edge
          </Button>
        </Tooltip>

        <Tooltip
          content="Asked for top placement. Scroll until this button is near the top of the window and it flips underneath."
          placement="top"
        >
          <Button appearance="subdued" brand="neutral">
            Flips vertically
          </Button>
        </Tooltip>

        <Tooltip
          content="Asked for right placement with no room to the right, so it slides back into view rather than off the edge."
          placement="right"
        >
          <Button appearance="subdued" brand="neutral">
            Right edge
          </Button>
        </Tooltip>
      </div>

      <div className="h-40 overflow-auto rounded-sm border border-stroke-weak bg-surface-low p-4">
        <Typography appearance="subdued" typographyType="body-xs">
          This box scrolls and clips its children. The tooltip below still escapes it, because it
          renders into the overlay host rather than in place.
        </Typography>

        <div className="my-24">
          <Tooltip content="Rendered outside the scroll container, so nothing clips it.">
            <Button appearance="subdued" brand="neutral">
              Inside a clipping container
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Delay grouping
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        The first row shares one delay: the first tooltip waits, then moving along the row swaps
        instantly. The second row has no group, so every button waits out its own 300ms.
      </Typography>

      <TooltipDelayGroup>
        <div className="flex items-center gap-x-1">
          {toolbarActions.map((action) => (
            <Tooltip content={action.label} key={action.label}>
              <Button
                appearance="weak"
                aria-label={action.label}
                brand="neutral"
                leftIconPath={action.iconPath}
                size="sm"
              />
            </Tooltip>
          ))}
        </div>
      </TooltipDelayGroup>

      <div className="flex items-center gap-x-1">
        {toolbarActions.map((action) => (
          <Tooltip content={action.label} key={action.label}>
            <Button
              appearance="weak"
              aria-label={action.label}
              brand="neutral"
              leftIconPath={action.iconPath}
              size="sm"
            />
          </Tooltip>
        ))}
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Interactive content
      </Typography>

      <Typography appearance="subdued" typographyType="body-sm">
        With `interactive`, the pointer can travel from the trigger into the tooltip along a safe
        path and use what is inside. Without it the tooltip ignores the pointer entirely.
      </Typography>

      <div className="flex flex-wrap items-center gap-4">
        <Tooltip
          interactive
          customContent={
            <div className="space-y-2 px-4 py-3">
              <Typography typographyType="body-xs">
                This mod is hidden because its game is not managed yet.
              </Typography>

              <TypographyLink
                brand="primary"
                rightIconPath={mdiOpenInNew}
                typographyType="body-xs"
                onClick={() => undefined}
              >
                Manage this game
              </TypographyLink>
            </div>
          }
        >
          <Button appearance="subdued" brand="neutral">
            Interactive
          </Button>
        </Tooltip>

        <Tooltip content="Try to click the link — the pointer never reaches it.">
          <Button appearance="subdued" brand="neutral">
            Non-interactive
          </Button>
        </Tooltip>
      </div>
    </div>

    <div className="space-y-4">
      <Typography as="h3" typographyType="heading-xs">
        Design Notes
      </Typography>

      <Typography appearance="subdued" as="ul" className="list-inside list-disc space-y-2">
        <li>
          For new tooltips only — the existing `controls/TooltipControls` components are unchanged
        </li>

        <li>
          Flips, slides and clamps against the window; `placement` is a preference, not a guarantee
        </li>

        <li>Portals into the overlay host, so tables and scroll panes cannot clip it</li>

        <li>Shows on focus as well as hover, and dismisses on Escape</li>

        <li>
          Non-interactive by default, so it never intercepts a click; opt in with `interactive`
        </li>

        <li>Wrap groups of triggers in `TooltipDelayGroup` so scanning a row feels instant</li>
      </Typography>
    </div>
  </div>
);
