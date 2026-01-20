/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "disallow importing Bluebird as 'Promise'",
    },
    messages: {
      renamePromise:
        "Do not import Bluebird as 'Promise'. Rename to 'PromiseBB'",
    },
    schema: [],
  },
  create: function (context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        if (source !== "bluebird") return;

        const defaultSpecified = node.specifiers.find(
          (spec) =>
            spec.type === "ImportDefaultSpecifier" &&
            spec.local.name === "Promise",
        );

        if (!defaultSpecified) return;
        context.report({
          node: defaultSpecified.local,
          messageId: "renamePromise",
        });
      },
    };
  },
};
