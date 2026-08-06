/**
 * Alert Demo Component
 * Demonstrates the four severities, with and without an action, and dismissible.
 */

import React from "react";

import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

export const AlertDemo = () => (
  <div className="space-y-8">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        Alert
      </Typography>

      <Typography appearance="subdued">
        A full-width bar carrying a short message about the page it sits on, optionally with a
        control that acts on it. Replaces the old Bootstrap alert.
      </Typography>
    </div>

    <div>
      <Alert
        action={
          <Button brand="neutral" size="xs">
            Find out more
          </Button>
        }
      >
        We suggest you do this
      </Alert>

      <Alert
        action={
          <Button brand="neutral" size="xs">
            Restart Vortex
          </Button>
        }
        severity="warning"
      >
        You need to restart Vortex to apply changes
      </Alert>

      <Alert
        action={
          <Button brand="neutral" size="xs">
            Free up disk space
          </Button>
        }
        severity="danger"
      >
        Disk space full
      </Alert>

      <Alert
        action={
          <Button brand="neutral" size="xs">
            View page
          </Button>
        }
        severity="success"
      >
        Action successful
      </Alert>
    </div>

    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        Without an action
      </Typography>

      <Typography appearance="subdued">
        The action is optional — an alert can simply state something. Severity colours the icon
        only, so a stack of them reads as one band rather than four competing blocks.
      </Typography>
    </div>

    <div>
      <Alert>Nothing needs doing right now</Alert>

      <Alert severity="warning">Some extensions couldn't be loaded</Alert>
    </div>

    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        Dismissible
      </Typography>

      <Typography appearance="subdued">
        Passing an onDismiss callback adds a close button at the far edge. Clicking it hides the
        alert and fires the callback.
      </Typography>
    </div>

    <div>
      <Alert
        action={
          <Button brand="neutral" size="xs">
            Find out more
          </Button>
        }
        onDismiss={() => undefined}
      >
        We suggest you do this
      </Alert>

      <Alert severity="warning" onDismiss={() => undefined}>
        You need to restart Vortex to apply changes
      </Alert>

      <Alert severity="danger" onDismiss={() => undefined}>
        Disk space full
      </Alert>
    </div>

    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        Long messages
      </Typography>

      <Typography appearance="subdued">
        The message wraps onto as many lines as it needs while the action and close button keep
        their width and stay on their own edges.
      </Typography>
    </div>

    <div>
      <Alert
        action={
          <Button brand="neutral" size="xs">
            Restart Vortex
          </Button>
        }
        severity="warning"
        onDismiss={() => undefined}
      >
        You need to restart Vortex to apply changes. You need to restart Vortex to apply changes.
        You need to restart Vortex to apply changes. You need to restart Vortex to apply changes.
        You need to restart Vortex to apply changes. You need to restart Vortex to apply changes.
        You need to restart Vortex to apply changes.
      </Alert>

      <Alert>
        Nothing needs doing right now, but here is a much longer explanation of why that is the
        case, long enough that it has to run onto a second line even on a wide window, so you can
        see how a bare message behaves without an action or a close button alongside it.
      </Alert>
    </div>
  </div>
);
