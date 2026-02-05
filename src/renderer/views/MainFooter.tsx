import React, { type FC, type JSX } from "react";

import type { PropsCallbackTyped } from "../../types/IExtensionContext";

import { useExtensionObjects } from "../../util/ExtensionProvider";

export interface IBaseProps {
  slim: boolean;
}

interface IFooter {
  id: string;
  component: React.ComponentType<IBaseProps>;
  props: PropsCallbackTyped<IBaseProps>;
}

const registerFooter = (
  _instanceGroup: undefined,
  id: string,
  component: React.ComponentType<IBaseProps>,
  props: PropsCallbackTyped<IBaseProps>,
): IFooter => {
  return { id, component, props };
};

/**
 * Footer on the main window. Can be extended
 */
export const MainFooter: FC<IBaseProps> = ({ slim }) => {
  const footers = useExtensionObjects<IFooter>(registerFooter);

  const renderFooter = (footer: IFooter): JSX.Element => {
    const props = footer.props !== undefined ? footer.props() : {};
    return <footer.component key={footer.id} slim={slim} {...props} />;
  };

  return <div id="main-footer">{footers.map(renderFooter)}</div>;
};

export default MainFooter;
