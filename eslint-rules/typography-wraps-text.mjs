// Typography styles a block that its descendants inherit, so it wraps a list or a run of
// paragraphs rather than repeating per item. See docs/frontend.md, "Text".

const COMPONENT = "Typography";
const STYLE_PROPS = new Set(["as", "appearance", "brand", "className", "typographyType"]);
const STYLED_BY_PARENT = new Set(["li", "td", "th", "dt", "dd"]);

const nameOf = (node) =>
  node.type === "JSXElement" && node.openingElement.name.type === "JSXIdentifier"
    ? node.openingElement.name.name
    : undefined;

const meaningfulChildren = (node) =>
  node.children.filter((child) => !(child.type === "JSXText" && child.value.trim() === ""));

/** The element's style props as one comparable string; undefined when a spread hides them. */
const styleKey = (element, sourceCode) => {
  const attributes = element.openingElement.attributes;
  if (attributes.some((attribute) => attribute.type === "JSXSpreadAttribute")) {
    return undefined;
  }

  return attributes
    .filter((attribute) => STYLE_PROPS.has(attribute.name.name))
    .map((attribute) => sourceCode.getText(attribute))
    .sort()
    .join(" ");
};

/** Whether it keeps its parent's type style, so it only changes colour. */
const inheritsType = (element) =>
  element.openingElement.attributes.some(
    (attribute) =>
      attribute.type === "JSXAttribute" &&
      attribute.name.name === "typographyType" &&
      attribute.value?.type === "Literal" &&
      attribute.value.value === "inherit",
  );

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "wrap a list or run of paragraphs in one Typography rather than one per item",
    },
    messages: {
      styledByParent:
        "Put the Typography on the <{{parent}}>'s list or table, or style the <{{parent}}> itself; it inherits the type style.",
      repeatedSiblings:
        'Adjacent Typography with the same style: wrap them in one (e.g. as="div" className="space-y-2") with plain elements inside.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    const checkRuns = (parent) => {
      let runKey;
      let runLength = 0;

      for (const child of meaningfulChildren(parent)) {
        const key = nameOf(child) === COMPONENT ? styleKey(child, sourceCode) : undefined;

        if (key !== undefined && key === runKey) {
          runLength += 1;
          if (runLength === 2) {
            context.report({ node: child.openingElement, messageId: "repeatedSiblings" });
          }
        } else {
          runKey = key;
          runLength = key === undefined ? 0 : 1;
        }
      }
    };

    return {
      JSXElement(node) {
        const parent = nameOf(node);
        const children = meaningfulChildren(node);

        if (
          STYLED_BY_PARENT.has(parent) &&
          children.length === 1 &&
          nameOf(children[0]) === COMPONENT &&
          !inheritsType(children[0])
        ) {
          context.report({
            node: children[0].openingElement,
            messageId: "styledByParent",
            data: { parent },
          });
        }

        checkRuns(node);
      },
      JSXFragment: checkRuns,
    };
  },
};
