import { withInfo } from "@storybook/addon-info";
import { withKnobs, boolean, number, select } from "@storybook/addon-knobs";
import React from "react";

import Icon from "./Icon";

export default {
  title: "Icon",
  parameters: {
    componentSubtitle: "Simple svg icon",
    decorators: [withInfo, withKnobs],
    info: {
      inline: true,
    },
  },
};

export const simple = () => (
  <Icon
    rotate={number("rotate", 0, { min: 0, max: 360 })}
    spin={boolean("spin", false)}
    pulse={boolean("pulse", false)}
    stroke={boolean("stroke", false)}
    border={boolean("border", false)}
    hollow={boolean("hollow", false)}
    name={select("name", { Sample: "sample", Spinner: "spinner" }, "sample")}
  />
);
