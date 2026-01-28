import * as React from "react";

import type { PropsCallback } from "../../types/IExtensionContext";

import { useExtensionObjects } from "../../util/ExtensionProvider";

export interface IBaseProps {
  slim: boolean;
}

interface IFooter {
  id: string;
  component: React.ComponentClass;
  props: PropsCallback;
}

function registerFooter(
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentClass,
  props: PropsCallback,
): IFooter {
  return { id, component, props };
}

/**
 * Footer on the main window. Can be extended
 */
export const MainFooter: React.FC<IBaseProps> = ({ slim }) => {
  const objects = useExtensionObjects<IFooter>(registerFooter);

  const renderFooter = (footer: IFooter): JSX.Element => {
    const props = footer.props !== undefined ? footer.props() : {};
    return <footer.component key={footer.id} slim={slim} {...props} />;
  };

  return <div id="main-footer">{objects.map(renderFooter)}</div>;
};

export default MainFooter;
