import path from "node:path";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "disallow specific cross-directory imports",
    },
    messages: {
      importRendererInMain:
        "Importing {{ source }} from the renderer project is not allowed in the main project",
      importMainInRenderer:
        "Importing {{ source }} from the main project is not allowed in the renderer project",
      importMainInShared:
        "Importing {{ source }} from the main project is not allowed in the shared project",
      importRendererInShared:
        "Importing {{ source }} from the renderer project is not allowed in the shared project",
    },
    schema: [],
  },
  create: function (context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        if (!source.startsWith(".")) return;

        const filename = context.filename;
        if (typeof filename !== "string") return;

        const toImport = path.join(path.dirname(filename), source);

        const root = path.join(context.cwd, "src");
        const mainDirectory = path.join(root, "main");
        const rendererDirectory = path.join(root, "renderer");
        const sharedDirectory = path.join(root, "shared");

        const importsFromMain = toImport.startsWith(mainDirectory);
        const importsFromRenderer = toImport.startsWith(rendererDirectory);

        if (filename.startsWith(mainDirectory) && importsFromRenderer) {
          context.report({
            messageId: "importRendererInMain",
            node: node,
            data: {
              source,
            },
          });
        } else if (filename.startsWith(rendererDirectory) && importsFromMain) {
          context.report({
            messageId: "importMainInRenderer",
            node: node,
            data: {
              source,
            },
          });
        } else if (filename.startsWith(sharedDirectory)) {
          if (importsFromMain) {
            context.report({
              messageId: "importMainInShared",
              node: node,
              data: {
                source,
              },
            });
          } else if (importsFromRenderer) {
            context.report({
              messageId: "importRendererInShared",
              node: node,
              data: {
                source,
              },
            });
          }
        }
      },
    };
  },
};
