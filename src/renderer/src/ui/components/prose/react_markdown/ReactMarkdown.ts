// react-markdown is ESM-only from version 7, and the renderer compiles to CommonJS
// (`module: node16` in tsconfig.json), which can't `import` an ES module. So it's loaded with
// require() and typed from the ES module itself. webpack leaves node_modules external
// (webpack.config.cjs), so this require() runs in Electron's Node at runtime, which can require()
// an ES module as long as nothing it loads uses top-level await. Import react-markdown from here,
// not from the package. Once the renderer compiles to ES modules this can become a plain
// re-export.
import type * as ReactMarkdownModule from "react-markdown" with { "resolution-mode": "import" };

const reactMarkdown = require("react-markdown") as typeof ReactMarkdownModule;

/** Renders the markdown passed as its children. */
export const ReactMarkdown = reactMarkdown.default;
