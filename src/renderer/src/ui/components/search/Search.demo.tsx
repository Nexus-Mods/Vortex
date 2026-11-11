/** Demonstrates Search: searching as it's typed or on Enter, clearing, and an error under it. */

import React, { useState } from "react";

import { FormDemoSection as Section } from "@/ui/components/form/FormDemoSection";
import { Typography } from "@/ui/components/typography/Typography";

import { Search } from "./Search";

/** A box that searches as it's typed, showing what it would search for. */
const LiveExample = () => {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-2">
      <Search placeholder="Search games..." value={value} onChange={setValue} />

      <Typography appearance="subdued" typographyType="body-sm">
        Searching for: {value || "nothing"}
      </Typography>
    </div>
  );
};

/**
 * A box that searches on Enter, refusing fewer than 2 characters with an error until the text
 * changes. Emptying it clears the search at once.
 */
const SubmitExample = () => {
  const [value, setValue] = useState("");
  const [searched, setSearched] = useState("");
  const [isTooShort, setIsTooShort] = useState(false);

  return (
    <div className="space-y-2">
      <Search
        errorMessage={isTooShort ? "Enter at least 2 characters to search." : undefined}
        maxLength={100}
        placeholder="Search mods..."
        value={value}
        onChange={(text) => {
          setValue(text);
          setIsTooShort(false);

          if (!text) {
            setSearched("");
          }
        }}
        onSubmit={() => {
          if (value.trim().length < 2) {
            setIsTooShort(true);
            return;
          }

          setSearched(value.trim());
        }}
      />

      <Typography appearance="subdued" typographyType="body-sm">
        Searched for: {searched || "nothing"}
      </Typography>
    </div>
  );
};

export const SearchDemo = () => (
  <div className="space-y-10">
    <div className="rounded-sm bg-surface-mid p-4">
      <Typography as="h3" typographyType="heading-xs">
        Search
      </Typography>

      <Typography appearance="subdued">
        A search box with a search icon, and a clear button while it holds text. Escape clears it
        too. With onSubmit it searches on Enter; without, as it&apos;s typed.
      </Typography>
    </div>

    <Section
      description="Without onSubmit, onChange is the search. Type, then clear with the button or Escape."
      title="Search as you type"
    >
      <LiveExample />
    </Section>

    <Section
      description="With onSubmit, Enter searches. maxLength stops the text at 100 characters without a count, and errorMessage shows in a tooltip under the box, so nothing around it moves."
      title="Search on Enter"
    >
      <SubmitExample />
    </Section>
  </div>
);
