import path from "node:path";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "disallow specific cross-directory imports",
    },
    messages: {
      importMainInRenderer:
        "Importing {{ source }} from the main project is not allowed in the renderer project",
      importNonMain:
        "Importing {{ source }} from outside the main and shared project is not allowed in the main project",
      importNonShared:
        "Importing {{ source }} from outside the shared project is not allowed",
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
        const importsFromShared = toImport.startsWith(sharedDirectory);

        if (
          filename.startsWith(mainDirectory) &&
          !importsFromMain &&
          !importsFromShared
        ) {
          context.report({
            messageId: "importNonMain",
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
        } else if (filename.startsWith(sharedDirectory) && !importsFromShared) {
          context.report({
            messageId: "importNonShared",
            node: node,
            data: {
              source,
            },
          });
        }
      },
    };
  },
};
