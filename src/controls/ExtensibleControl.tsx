import { extend } from '../util/ExtensionProvider';

import * as React from 'react';

export interface IExtensibleControlProps {
  wrapperProps?: any;
}

interface IWrapperProps {
  priority: number;
  wrapper: React.ComponentType<{}>;
}

interface IExtensionProps {
  objects: IWrapperProps[];
}

type IProps = IExtensibleControlProps & IExtensionProps;

function ExtensibleControl(props: React.PropsWithChildren<IProps>) {
  const { objects, wrapperProps } = props;
  const wrappers = objects.sort((lhs, rhs) => rhs.priority - lhs.priority);
  let cur = <>{props.children}</>;

  for (const wrapper of wrappers) {
    cur = (<wrapper.wrapper {...(wrapperProps ?? {})}>{cur}</wrapper.wrapper>);
  }

  return cur;
}

function registerControlWrapper(instanceGroup: string,
                                group: string,
                                priority: number,
                                wrapper: React.ComponentType<{}>) {

  if (instanceGroup === group) {
    return { priority, wrapper };
  }
}

export default extend(registerControlWrapper, 'group')(ExtensibleControl);
