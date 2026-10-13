import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { IProseProps } from "../Prose.types";

interface IPlainTextProps extends IProseProps {
  /** The text to render, such as a changelog written without markup. */
  text: string;
}

/**
 * Plain text, such as a changelog written without markup, in the prose styles `Markdown` and
 * `Html` render theirs in, its line breaks kept and nothing in it read as formatting.
 */
export const PlainText = ({ text, size = "md", className }: IPlainTextProps) => (
  <p
    className={joinClasses(["nxm-prose whitespace-pre-line", className], {
      "nxm-prose-sm": size === "sm",
    })}
  >
    {text}
  </p>
);
