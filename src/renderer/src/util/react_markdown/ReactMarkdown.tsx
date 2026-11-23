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
 * may sign in to with the user's credentials, so they're dropped. So is a file URL with no host
 * whose path starts with two slashes, such as `file:////host/share/x.png` or `////host/share/x.png`,
 * which Windows reads as the network path `\\host\share`. The path counts its separators whether
 * they're slashes, backslashes or escaped as `%2F` or `%5C`, which is how the markdown parser
 * passes on a backslash, so `\\host\share` and `file:\\\\host\share` are dropped too.
 */
const imageSrc = (src: string): string | undefined => {
  const url = URL.parse(src, "file:///");
  if (url === null) {
    return undefined;
  }
  if (["http:", "https:", "data:"].includes(url.protocol)) {
    return src;
  }
  const path = url.pathname.replace(/%2f|%5c/gi, "/");
  const onThisMachine = url.protocol === "file:" && url.host === "" && !path.startsWith("//");
  return onThisMachine ? src : undefined;
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
 * The options with links rendered as `WebLink` unless `components.a` says otherwise, and every URL
 * going through `safeUrl` after the caller's own `urlTransform`, rather than that replacing it.
 */
const withSafeUrls = (options: ReactMarkdownProps): ReactMarkdownProps => {
  const { components, urlTransform } = options;
  return {
    ...options,
    components: { a: WebLink, ...components },
    urlTransform: (url, key, node) =>
      safeUrl(urlTransform ? urlTransform(url, key, node) : url, key),
  };
};

/**
 * Renders the markdown passed as its children, for the older call sites styled by their own SCSS.
 * New UI uses `Markdown` (`ui/components/prose/markdown`), which also styles it and filters images.
 *
 * Links render as `WebLink` unless `components.a` says otherwise. A `urlTransform` runs before
 * `safeUrl`, rather than replacing it.
 */
export const ReactMarkdown = (props: ReactMarkdownProps) => (
  <reactMarkdown.default {...withSafeUrls(props)} />
);

/**
 * Props react-markdown 6 took that 9 doesn't, and what replaces each in 9, if anything. 6 still
 * ran `plugins`, as `remarkPlugins`, so the extension shim passes it on as that. The ones from
 * `renderers` on, 6 had already deprecated: it warned about them and ignored them.
 */
const removedProps: Record<string, string | undefined> = {
  transformLinkUri: "urlTransform",
  transformImageUri: "urlTransform",
  linkTarget: "components.a",
  includeElementIndex: undefined,
  rawSourcePos: undefined,
  sourcePos: undefined,
  plugins: "remarkPlugins",
  renderers: "components",
  source: "children",
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

type Plugins = ReactMarkdownProps["remarkPlugins"];

interface IPluginCheck {
  children: ReactMarkdownProps["children"];
  remarkPlugins: Plugins;
  rehypePlugins: Plugins;
  /** What the plugins threw, if they did and the markdown renders without them. */
  error?: { thrown: unknown };
}

/** What rendering these options throws, if anything. It only builds elements: no component runs. */
const renderError = (options: ReactMarkdownProps): { thrown: unknown } | undefined => {
  try {
    reactMarkdown.default(options);
    return undefined;
  } catch (thrown) {
    return { thrown };
  }
};

/**
 * Runs the extension's remark and rehype plugins on its markdown, on their own: without its
 * components or any other option, so only an error the plugins cause counts against them. If the
 * markdown throws without the plugins too, they aren't to blame, and the error is left to the
 * real render.
 */
const checkPlugins = ({ children, remarkPlugins, rehypePlugins }: ReactMarkdownProps) => {
  const check: IPluginCheck = { children, remarkPlugins, rehypePlugins };
  if (remarkPlugins === undefined && rehypePlugins === undefined) {
    return check;
  }
  const withPlugins = renderError({ children, remarkPlugins, rehypePlugins });
  if (withPlugins !== undefined && renderError({ children }) === undefined) {
    check.error = withPlugins;
  }
  return check;
};

/** Whether two plugin entries are the same plugin with the same options, element by element. */
const samePluggable = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((item, index) => Object.is(item, b[index])));

/**
 * Whether two plugin lists hold the same plugins. Extensions pass inline arrays, which are new on
 * every render, so the lists are compared element by element rather than by identity.
 */
const samePlugins = (a: Plugins, b: Plugins): boolean =>
  Object.is(a, b) ||
  (Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((plugin, index) => samePluggable(plugin, b[index])));

/**
 * Whether the extension's plugins can be used on this markdown. Plugins made for 6, such as
 * remark-gfm 1, throw under 9, which would otherwise unmount the extension's UI. Checked again
 * whenever the markdown or the plugins change, and `onDrop` hears about each check that fails.
 */
const usePluginsWork = (
  props: ReactMarkdownProps,
  onDrop: (check: IPluginCheck & { error: { thrown: unknown } }) => void,
): boolean => {
  const [check, setCheck] = React.useState(() => checkPlugins(props));
  let current = check;
  if (
    !Object.is(check.children, props.children) ||
    !samePlugins(check.remarkPlugins, props.remarkPlugins) ||
    !samePlugins(check.rehypePlugins, props.rehypePlugins)
  ) {
    current = checkPlugins(props);
    setCheck(current);
  }

  React.useEffect(() => {
    if (current.error !== undefined) {
      onDrop({ ...current, error: current.error });
    }
  }, [current, onDrop]);

  return current.error === undefined;
};

/**
 * What an extension gets for `require("react-markdown")`. Extensions were built against 6, a
 * CommonJS module that was the component itself, but require() of 9 returns the ES module's
 * namespace, which React can't render. So this is the component, carrying itself as `default` and
 * the module's other exports, which every way of importing 6 or 9 resolves to, plus 6's
 * `uriTransformer`. `MarkdownHooks` and `MarkdownAsync` filter URLs as the component does.
 *
 * 9 ignores 6's removed props, or throws on them in a development build, so they're dropped and
 * `report`ed instead, apart from the two URL transforms, which 9's `urlTransform` still runs, and
 * `plugins`, which goes on as `remarkPlugins`.
 */
export const makeExtensionReactMarkdown = (
  report: (method: string, replacement?: string) => void,
) => {
  const reportPlugins = (check: IPluginCheck & { error: { thrown: unknown } }) => {
    for (const name of ["remarkPlugins", "rehypePlugins"] as const) {
      if (check[name] !== undefined) {
        report(`react-markdown.${name}`, "a version of the plugin made for react-markdown 9");
      }
    }
    log("warn", "react-markdown plugins threw, so the markdown is shown without them", {
      error: getErrorMessageOrDefault(check.error.thrown),
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
    kept.remarkPlugins ??= props.plugins as Plugins;
    kept.urlTransform = withRemovedTransforms(
      props.urlTransform,
      props.transformLinkUri,
      props.transformImageUri,
    );

    const pluginsWork = usePluginsWork(kept, reportPlugins);
    if (pluginsWork) {
      return <ReactMarkdown {...kept} />;
    }
    const { remarkPlugins, rehypePlugins, ...withoutPlugins } = kept;
    return <ReactMarkdown {...withoutPlugins} />;
  };

  const MarkdownHooks = (props: ReactMarkdownProps) => (
    <reactMarkdown.MarkdownHooks {...withSafeUrls(props)} />
  );

  const MarkdownAsync = (options: ReactMarkdownProps) =>
    reactMarkdown.MarkdownAsync(withSafeUrls(options));

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
    MarkdownHooks,
    MarkdownAsync,
    uriTransformer,
  });
};
