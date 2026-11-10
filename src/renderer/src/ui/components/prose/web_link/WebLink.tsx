import React, { type ReactNode } from "react";

import { webHref } from "@/ui/utils/webHref";

/** A link's target, if it's an email address to write to, which only opens the user's mail app. */
const mailHref = (href: string | undefined): string | undefined =>
  href !== undefined && URL.parse(href)?.protocol === "mailto:" ? href : undefined;

/**
 * A link in markdown we don't write ourselves, its target kept only if it's a web page or an email
 * address, so it can't open a file or app. For `ReactMarkdown`'s `a`: its own filter only stops
 * targets with a scheme, so `//server/share` or `../run.exe` resolve against the app's `file://`
 * page, and the main window opens whatever a link navigates to.
 */
export const WebLink = ({ href, children }: { href?: string; children?: ReactNode }) => (
  <a href={webHref(href) ?? mailHref(href)}>{children}</a>
);
