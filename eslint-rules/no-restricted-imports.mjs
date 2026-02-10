/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow imports",
    },
    messages: {},
    schema: [
      {
        type: "object",
        properties: {
          restrictions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                message: { type: "string" },
              },
              required: ["name", "message"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create: function (context) {
    const config = context.options[0] || {};
    const restrictions = config.restrictions || [];

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;

        const matched = restrictions.find((r) => r.name === source);
        if (!matched) return;

        context.report({
          node: node,
          message: matched.message,
        });
      },
    };
  },
};
