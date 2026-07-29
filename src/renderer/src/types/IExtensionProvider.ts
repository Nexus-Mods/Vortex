import type * as React from "react";

export interface IExtensibleProps {
  group?: string;
  staticElements?: any[];
  children?: React.ReactNode;
}

export interface IExtendedProps {
  objects: any[];
}
