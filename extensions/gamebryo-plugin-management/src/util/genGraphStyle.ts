function transformRules(rules: CSSStyleRule[]): { [id: string]: any } {
  return rules
    .filter(
      (rule) =>
        rule.selectorText !== undefined &&
        rule.selectorText.startsWith("#variable"),
    )
    .reduce((prev, rule) => {
      const [id, type, key] = rule.selectorText.split(" ");
      prev[key.slice(1)] = rule.style[type.slice(1)];
      return prev;
    }, {});
}

export default function (rules: CSSStyleRule[]) {
  const variables = transformRules(rules);

  return [
    {
      selector: "node[title]",
      style: {
        "background-color": variables["brand-bg"],
        label: "data(title)",
        color: variables["text-color"],
        "text-background-color": variables["brand-bg"],
        "text-border-opacity": 1,
        "text-border-width": 1,
        "text-border-color": variables["border-color"],
        "text-border-style": "solid",
        "text-background-opacity": 1,
        "text-background-padding": "4px",
        "text-margin-y": "-20px",
        "font-family": "Roboto",
        "overlay-color": variables["link-hover-color"],
      },
    },
    {
      selector: "node.masterlist",
      style: {
        "background-blacken": -0.5,
      },
    },
    {
      selector: "node.group-default",
      style: {
        "background-color": variables["brand-info"],
      },
    },
    {
      selector: "node[[indegree = 0]][[outdegree > 0]]",
      style: {
        "background-color": variables["brand-highlight"],
      },
    },
    {
      selector: "node[[outdegree = 0]][[indegree > 0]]",
      style: {
        "background-color": variables["brand-success"],
      },
    },
    {
      selector: "edge",
      style: {
        width: 2,
        "curve-style": "bezier",
        "arrow-scale": 1.25,
        "text-rotation": "autorotate",
      },
    },
    {
      selector: "edge.masterlist",
      style: {
        "line-color": variables["text-color-disabled"],
        "mid-source-arrow-shape": "triangle",
        "mid-source-arrow-color": variables["text-color-disabled"],
        "source-endpoint": "inside-to-node",
      },
    },
    {
      selector: "edge.userlist",
      style: {
        "line-color": variables["link-color"],
        "mid-target-arrow-shape": "triangle",
        "mid-target-arrow-color": variables["link-color"],
        "target-endpoint": "inside-to-node",
      },
    },
    {
      selector: "node.eh-handle",
      style: {
        label: "",
        "background-color": variables["brand-primary"],
        height: 15,
        width: 15,
      },
    },
  ];
}
