import type { ReactNode } from "react";

export interface IExtensibleProps {
  group?: string;
  staticElements?: any[];
  children?: ReactNode;
}

export interface IExtendedProps {
  objects: any[];
}
