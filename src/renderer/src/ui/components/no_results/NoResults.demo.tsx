/** Demonstrates NoResults: its icon, message, actions, footnote and error, and a panel around it. */

import React, { type PropsWithChildren } from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import { NoResults } from "./NoResults";

/** A heading and description, then the examples on the page's background. */
const Section = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) => (
  <div className="space-y-4">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-sm">
        {title}
      </Typography>

      <Typography appearance="subdued">{description}</Typography>
    </div>

    <div className="space-y-8">{children}</div>
  </div>
);

export const NoResultsDemo = () => (
  <div className="space-y-10">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h2" typographyType="heading-sm">
        No results
      </Typography>

      <Typography appearance="subdued">
        What a list or page says when there's nothing to show, or loading it failed: a title, and
        optionally an icon, a message, actions and a footnote. It draws no background of its own;
        wrap it where it's used for one.
      </Typography>
    </div>

    <Section description="Just a title, then with an icon and a message." title="Content">
      <NoResults title="No mods found" />

      <NoResults
        icon="zoom_out"
        message="Try adjusting your filters or search terms."
        title="No mods found"
      />
    </Section>

    <Section description="Anything given as children shows under the message." title="Actions">
      <NoResults message="Try removing some filters." title="No mods match your filters">
        <div className="flex flex-wrap justify-center gap-2">
          <Button appearance="moderate" brand="neutral" leftIcon="close">
            Remove 2 filters
          </Button>

          <Button appearance="moderate" brand="neutral" rightIcon="open_in_new">
            Search on website
          </Button>
        </div>
      </NoResults>
    </Section>

    <Section
      description="A note under the actions, by an info icon, in small text."
      title="Footnote"
    >
      <NoResults
        footnote="Mods that don't support mod managers or use legacy requirements are hidden."
        message="That's every mod Vortex can show for this view."
        title="You've reached the end"
      />
    </Section>

    <Section
      description="isError fills in a title, message and icon, with Try again given onRetry, and Contact support."
      title="Error"
    >
      <NoResults
        isError
        message="The mods couldn't be loaded. Try again."
        onRetry={() => {}}
        title="Something went wrong"
      />
    </Section>

    <Section description="The success appearance colours the icon." title="Success">
      <NoResults appearance="success" icon="check_circle" title="Everything's up to date" />
    </Section>

    <Section
      description="Browse's mod list wraps it in a dark panel, widens it, and pulls the footnote closer to the actions."
      title="In a panel"
    >
      <div className="rounded-sm bg-translucent-dark-200 p-8 [&>div]:max-w-none [&>div>:last-child]:-mt-2">
        <NoResults
          footnote="Mods that don't support mod managers or use legacy requirements are hidden."
          message="Try a different search or remove filters."
          title={'No mods match "SkyUI"'}
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button appearance="moderate" brand="neutral" leftIcon="close">
              Remove 3 filters
            </Button>

            <Button appearance="moderate" brand="neutral" rightIcon="open_in_new">
              Search on website
            </Button>
          </div>
        </NoResults>
      </div>
    </Section>
  </div>
);
