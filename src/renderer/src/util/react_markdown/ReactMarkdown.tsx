import React from "react";
// react-markdown is ESM-only from version 7, and the renderer compiles to CommonJS
// (`module: node16` in tsconfig.json), which can't `import` an ES module. So it's loaded with
// require() and typed from the ES module itself. webpack leaves node_modules external
// (webpack.config.cjs), so this require() runs in Electron's Node at runtime, which can require()
// an ES module as long as nothing it loads uses top-level await. Once the renderer compiles to ES
// modules the require() can become a plain import.
import type * as ReactMarkdownModule from "react-markdown" with { "resolution-mode": "import" };

import { WebLink } from "@/ui/components/prose/web_link/WebLink";

// eslint-disable-next-line no-restricted-syntax -- this is the one place react-markdown is loaded
const reactMarkdown = require("react-markdown") as typeof ReactMarkdownModule;

export type ReactMarkdownProps = ReactMarkdownModule.Options;

/**
 * Keeps what react-markdown 6 kept. A link react-markdown's own filter rejects, such as `steam:`,
 * gets no href rather than its `""`, which would reload the window when clicked. Image sources go
 * through untouched, as 6 never filtered them.
 */
const urlTransform: ReactMarkdownModule.UrlTransform = (url, key) => {
  if (key === "src") {
    return url;
  }
  const transformed = reactMarkdown.defaultUrlTransform(url);
  return transformed === "" ? undefined : transformed;
};

/**
 * Renders the markdown passed as its children, for the older call sites styled by their own SCSS.
 * New UI uses `Markdown` (`ui/components/prose/markdown`), which also styles it and filters images.
 *
 * Links render as `WebLink` unless `components.a` says otherwise, so a link only opens if it goes
 * to a web page or an email address: relative and `//server/share` links would otherwise resolve
 * against the app's `file://` page, and the main window opens whatever a link navigates to.
 */
export const ReactMarkdown = ({ components, ...props }: ReactMarkdownProps) => (
  <reactMarkdown.default
    components={{ a: WebLink, ...components }}
    urlTransform={urlTransform}
    {...props}
  />
);

/** Props react-markdown 6 took that 9 doesn't, and what replaces each, if anything. */
const removedProps: Record<string, string | undefined> = {
  transformLinkUri: "urlTransform",
  transformImageUri: "urlTransform",
  linkTarget: "components.a",
  includeElementIndex: undefined,
  rawSourcePos: undefined,
  sourcePos: undefined,
};

/**
 * What an extension gets for `require("react-markdown")`. Extensions were built against 6, a
 * CommonJS module that was the component itself, but require() of 9 returns the ES module's
 * namespace, which React can't render. So this is the component, carrying itself as `default` too,
 * which every way of importing 6 resolves to. 9 ignores 6's removed props, or throws on them in a
 * development build, so they're dropped and `report`ed instead.
 */
export const makeExtensionReactMarkdown = (
  report: (method: string, replacement?: string) => void,
) => {
  // Built once per extension (extensionRequire caches it), so it's a stable component type.
  // eslint-disable-next-line @eslint-react/component-hook-factories
  const ExtensionReactMarkdown = (props: ReactMarkdownProps & Record<string, unknown>) => {
    const kept: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(props)) {
      if (Object.hasOwn(removedProps, name)) {
        report(`react-markdown.${name}`, removedProps[name]);
      } else {
        kept[name] = value;
      }
    }
    return <ReactMarkdown {...kept} />;
  };
  return Object.assign(ExtensionReactMarkdown, { default: ExtensionReactMarkdown });
};
