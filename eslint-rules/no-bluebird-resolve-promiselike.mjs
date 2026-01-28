import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "disallow Bluebird.resolve() when passed a PromiseLike<T> value",
    },
    messages: {
      noPromiseLike:
        "Avoid Bluebird.resolve() with PromiseLike values. Use native Promises instead",
    },
    schema: [],
  },
  create: function (context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    /**
     * @param {import('@typescript-eslint/utils').TSESTree.CallExpression} node
     * @returns boolean
     * */
    function isBluebirdResolve(node) {
      const callee = node.callee;
      return (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        !callee.computed &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        (callee.object.name === "Bluebird" ||
          callee.object.name === "PromiseBB") &&
        callee.property.type === AST_NODE_TYPES.Identifier &&
        callee.property.name === "resolve"
      );
    }

    /**
     * @param {import("typescript").Type} type
     * @returns boolean
     * */
    function isPromiseLike(type) {
      // Unions like Promise<T> | null
      if (type.isUnion()) {
        return type.types.some(isPromiseLike);
      }

      // Native Promise<T>
      if (type.symbol && type.symbol.name === "Promise") {
        return true;
      }

      // PromiseLike<T> / thenables
      const thenProperty = type.getProperty("then");
      if (!thenProperty) {
        return false;
      }

      const declaration =
        thenProperty.valueDeclaration ||
        (thenProperty.declarations && thenProperty.declarations[0]);

      if (!declaration) {
        return false;
      }

      const thenType = checker.getTypeOfSymbolAtLocation(
        thenProperty,
        declaration,
      );

      return thenType.getCallSignatures().length > 0;
    }

    return {
      CallExpression(node) {
        if (!isBluebirdResolve(node)) return;
        if (node.arguments.length === 0) return;

        const arg = node.arguments[0];
        const tsNode = services.esTreeNodeToTSNodeMap.get(arg);
        const type = checker.getTypeAtLocation(tsNode);

        if (isPromiseLike(type)) {
          context.report({ node, messageId: "noPromiseLike" });
        }
      },
    };
  },
};
