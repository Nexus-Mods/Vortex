import path from "node:path";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "disallow module imports from shared project",
    },
    messages: {
      moduleImport:
        "Importing module {{ source }} in the shared project is not allowed",
    },
    schema: [],
  },
  create: function (context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        if (source.startsWith(".")) return;

        const filename = context.filename;
        const root = path.join(context.cwd, "src");
        const sharedDirectory = path.join(root, "shared");

        if (!filename.startsWith(sharedDirectory)) return;
        context.report({
          node: node,
          messageId: "moduleImport",
          data: {
            source: source,
          },
        });
      },
    };
  },
};
