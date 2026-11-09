import React, { type ReactNode } from "react";

import { webHref } from "@/ui/utils/webHref";

/**
 * A link in markdown we don't write ourselves, its target kept only if it's a web page, so it
 * can't open a file or app. For `ReactMarkdown`'s `a`: its own filter only stops targets with a
 * scheme, so `//server/share` or `../run.exe` resolve against the app's `file://` page, and the
 * main window opens whatever a link navigates to.
 */
export const WebLink = ({ href, children }: { href?: string; children?: ReactNode }) => (
  <a href={webHref(href)}>{children}</a>
);
