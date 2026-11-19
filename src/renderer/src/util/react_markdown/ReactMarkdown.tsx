import { getErrorMessageOrDefault } from "@vortex/shared";
import React from "react";
// react-markdown is ESM-only from version 7, and the renderer compiles to CommonJS
// (`module: node16` in tsconfig.json), which can't `import` an ES module. So it's loaded with
// require() and typed from the ES module itself. webpack leaves node_modules external
// (webpack.config.cjs), so this require() runs in Electron's Node at runtime, which can require()
// an ES module as long as nothing it loads uses top-level await. Once the renderer compiles to ES
// modules the require() can become a plain import.
import type * as ReactMarkdownModule from "react-markdown" with { "resolution-mode": "import" };

import { mailHref, WebLink } from "@/ui/components/prose/web_link/WebLink";
import { webHref } from "@/ui/utils/webHref";
import { log } from "@/util/log";

// eslint-disable-next-line no-restricted-syntax -- this is the one place react-markdown is loaded
const reactMarkdown = require("react-markdown") as typeof ReactMarkdownModule;

export type ReactMarkdownProps = ReactMarkdownModule.Options;

/**
 * An image's source, if loading it can't reach another machine through the file system: a web
 * address, an image held in the address, or a file on this machine. `//host/share/x.png` and
 * `\\host\share\x.png` resolve against the app's `file://` page to a network share, which Windows
 * may sign in to with the user's credentials, so they're dropped.
 */
const imageSrc = (src: string): string | undefined => {
  const url = URL.parse(src, "file:///");
  if (url === null) {
    return undefined;
  }
  if (["http:", "https:", "data:"].includes(url.protocol)) {
    return src;
  }
  return url.protocol === "file:" && url.host === "" ? src : undefined;
};

/**
 * Where a URL in the markdown may point, after any `urlTransform` the caller passed. A link keeps
 * its target only if it's a web page or an email address, so a link stays safe whatever renders
 * it. Anything else gets no target rather than react-markdown's own `""`, which would reload the
 * window when clicked. An image keeps its source if `imageSrc` does, which covers what
 * react-markdown 6 showed, as 6 never filtered images.
 */
const safeUrl = (url: string | null | undefined, key: string): string | undefined => {
  if (url === null || url === undefined) {
    return undefined;
  }
  return key === "src" ? imageSrc(url) : (webHref(url) ?? mailHref(url));
};

/**
 * Renders the markdown passed as its children, for the older call sites styled by their own SCSS.
 * New UI uses `Markdown` (`ui/components/prose/markdown`), which also styles it and filters images.
 *
 * Links render as `WebLink` unless `components.a` says otherwise. A `urlTransform` runs before
 * `safeUrl`, rather than replacing it.
 */
export const ReactMarkdown = ({ components, urlTransform, ...props }: ReactMarkdownProps) => (
  <reactMarkdown.default
    {...props}
    components={{ a: WebLink, ...components }}
    urlTransform={(url, key, node) =>
      safeUrl(urlTransform ? urlTransform(url, key, node) : url, key)
    }
  />
);

/**
 * Props react-markdown 6 took that 9 doesn't, and what replaces each in 9, if anything. The ones
 * from `renderers` on, 6 had already deprecated: it warned about them and ignored them.
 */
const removedProps: Record<string, string | undefined> = {
  transformLinkUri: "urlTransform",
  transformImageUri: "urlTransform",
  linkTarget: "components.a",
  includeElementIndex: undefined,
  rawSourcePos: undefined,
  sourcePos: undefined,
  renderers: "components",
  source: "children",
  plugins: "remarkPlugins",
  allowedTypes: "allowedElements",
  disallowedTypes: "disallowedElements",
  allowNode: "allowElement",
  includeNodeIndex: undefined,
  escapeHtml: undefined,
  allowDangerousHtml: undefined,
  astPlugins: undefined,
};

type LinkTransform = (href: string, children: unknown, title: string | null) => string;
type ImageTransform = (src: string, alt: string, title: string | null) => string;

/**
 * 6's `transformLinkUri` and `transformImageUri` as a 9 `urlTransform`, run before the
 * extension's own `urlTransform`, if it passed one too.
 */
const withRemovedTransforms = (
  urlTransform: ReactMarkdownProps["urlTransform"],
  transformLinkUri: unknown,
  transformImageUri: unknown,
): ReactMarkdownProps["urlTransform"] => {
  if (typeof transformLinkUri !== "function" && typeof transformImageUri !== "function") {
    return urlTransform;
  }
  return (url, key, node) => {
    const { alt, title } = node.properties;
    const titleText = typeof title === "string" ? title : null;
    let transformed = url;
    if (key === "src" && typeof transformImageUri === "function") {
      transformed = (transformImageUri as ImageTransform)(url, String(alt ?? ""), titleText);
    } else if (key !== "src" && typeof transformLinkUri === "function") {
      transformed = (transformLinkUri as LinkTransform)(url, node.children, titleText);
    }
    return urlTransform ? urlTransform(transformed, key, node) : transformed;
  };
};

interface IDropPluginsOnErrorProps {
  markdownProps: ReactMarkdownProps;
  onDrop: (error: unknown) => void;
}

/**
 * Renders an extension's markdown, and again without its remark and rehype plugins if rendering
 * throws. Plugins made for 6, such as remark-gfm 1, throw under 9, which would otherwise unmount
 * the extension's UI. If it throws without them too, the error goes on up.
 */
class DropPluginsOnError extends React.Component<IDropPluginsOnErrorProps, { failed: boolean }> {
  public state = { failed: false };

  public static getDerivedStateFromError() {
    return { failed: true };
  }

  public componentDidCatch(error: unknown) {
    this.props.onDrop(error);
  }

  public render() {
    const { remarkPlugins, rehypePlugins, ...withoutPlugins } = this.props.markdownProps;
    return <ReactMarkdown {...(this.state.failed ? withoutPlugins : this.props.markdownProps)} />;
  }
}

/**
 * What an extension gets for `require("react-markdown")`. Extensions were built against 6, a
 * CommonJS module that was the component itself, but require() of 9 returns the ES module's
 * namespace, which React can't render. So this is the component, carrying itself as `default` and
 * the module's other exports, which every way of importing 6 or 9 resolves to, plus 6's
 * `uriTransformer`. 9 ignores 6's removed props, or throws on them in a development build, so
 * they're dropped and `report`ed instead, apart from the two URL transforms, which 9's
 * `urlTransform` still runs.
 */
export const makeExtensionReactMarkdown = (
  report: (method: string, replacement?: string) => void,
) => {
  const reportPlugins = (props: ReactMarkdownProps, error: unknown) => {
    for (const name of ["remarkPlugins", "rehypePlugins"] as const) {
      if (props[name] !== undefined) {
        report(`react-markdown.${name}`, "a version of the plugin made for react-markdown 9");
      }
    }
    log("warn", "react-markdown plugins threw, so the markdown is shown without them", {
      error: getErrorMessageOrDefault(error),
    });
  };

  // Built once per extension (extensionRequire caches it), so it's a stable component type.
  // eslint-disable-next-line @eslint-react/component-hook-factories
  const ExtensionReactMarkdown = (props: ReactMarkdownProps & Record<string, unknown>) => {
    const kept: ReactMarkdownProps & Record<string, unknown> = {};
    for (const [name, value] of Object.entries(props)) {
      if (Object.hasOwn(removedProps, name)) {
        report(`react-markdown.${name}`, removedProps[name]);
      } else {
        kept[name] = value;
      }
    }
    kept.urlTransform = withRemovedTransforms(
      props.urlTransform,
      props.transformLinkUri,
      props.transformImageUri,
    );

    if (kept.remarkPlugins === undefined && kept.rehypePlugins === undefined) {
      return <ReactMarkdown {...kept} />;
    }
    return (
      <DropPluginsOnError markdownProps={kept} onDrop={(error) => reportPlugins(kept, error)} />
    );
  };

  const uriTransformer = (url: string) => {
    report("react-markdown.uriTransformer", "defaultUrlTransform");
    return reactMarkdown.defaultUrlTransform(url);
  };

  const { default: _, ...otherExports } = reactMarkdown as typeof ReactMarkdownModule & {
    __esModule?: boolean;
  };
  delete otherExports.__esModule;

  return Object.assign(ExtensionReactMarkdown, otherExports, {
    default: ExtensionReactMarkdown,
    uriTransformer,
  });
};
