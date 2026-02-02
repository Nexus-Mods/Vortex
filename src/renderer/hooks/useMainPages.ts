import React, { type ComponentType } from "react";

import type { IMainPageOptions } from "../../types/IExtensionContext";
import type { IMainPage } from "../../types/IMainPage";
import type { IRegisteredExtension } from "../../util/ExtensionManager";

import { useExtensionObjects } from "../../util/ExtensionProvider";

const trueFunc = () => true;

const emptyFunc = () => ({});

const registerMainPage = (
  _instanceGroup: undefined,
  extInfo: Partial<IRegisteredExtension>,
  icon: string,
  title: string,
  component: ComponentType,
  options: IMainPageOptions,
): IMainPage => {
  return {
    id: options.id || title,
    icon,
    title,
    component,
    propsFunc: options.props || emptyFunc,
    visible: options.visible || trueFunc,
    group: options.group,
    badge: options.badge,
    activity: options.activity,
    priority: options.priority !== undefined ? options.priority : 100,
    onReset: options.onReset,
    namespace: extInfo.namespace,
  };
};

export const useMainPages = (): IMainPage[] => {
  return useExtensionObjects<IMainPage>(
    registerMainPage,
    undefined,
    undefined,
    true,
  );
};
