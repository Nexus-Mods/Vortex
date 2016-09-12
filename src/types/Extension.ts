// <reference path="../typings/globals/react/index.d.ts" />
import * as React from 'react';

interface IRegisterSettings {
  (title: string, element: React.ComponentClass<any>): void;
}

export interface IExtensionContext {

  registerSettings: IRegisterSettings;
  registerReducer: any;
}

export interface IExtensionInit {
  (context: IExtensionContext): boolean;
}

export interface IExtensionProps {
  extensions: IExtensionInit[];
}
