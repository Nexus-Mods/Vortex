import { Tag } from "bbcode-to-react";
import * as React from "react";

import { Icon as NewIcon } from "@/ui/components/icon/Icon";
import { getIconProps } from "@/ui/components/icon/utils/icon_props/iconProps.util";
import { findIcon } from "@/views/components/icon_map/iconMap";

import Icon from "../Icon";

class SvgTag extends Tag {
  public toHTML(): string[] {
    return [
      `<svg
      preserveAspectRatio='xMidYMid meet'
      class='icon icon-${this.getContent()}'
    >
    <use xlink:href=#'${this.getContent()}'>
    </svg>`,
    ];
  }

  public toReact() {
    const name = this.getContent();
    // a name the new UI has an icon for draws as it does in the toolbar, so the two match
    const source = findIcon(name);

    return source === undefined ? (
      <Icon name={name} />
    ) : (
      <NewIcon {...getIconProps(source)} size="none" className="inline-block align-text-bottom" />
    );
  }
}

export default SvgTag;
