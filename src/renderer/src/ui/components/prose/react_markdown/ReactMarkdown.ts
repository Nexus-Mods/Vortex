// react-markdown is ESM-only from version 7, and the renderer compiles to CommonJS
// (`module: node16` in tsconfig.json), which can't `import` an ES module. So it's loaded with
// require(), which webpack bundles and Node 22 runs, and typed from the ES module itself. Import
// react-markdown from here, not from the package. Once the renderer compiles to ES modules this
// can become a plain re-export.
import type * as ReactMarkdownModule from "react-markdown" with { "resolution-mode": "import" };

const reactMarkdown = require("react-markdown") as typeof ReactMarkdownModule;

/** Renders the markdown passed as its children. */
export const ReactMarkdown = reactMarkdown.default;
