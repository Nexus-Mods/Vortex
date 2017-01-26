export interface IHeaderImage {
  path: string;
  showFade: boolean;
  height: number;
}

export type OrderType = 'AlphaAsc' | 'AlphaDesc' | 'Explicit';

export type GroupType =
  'SelectAtLeastOne' | 'SelectAtMostOne' | 'SelectExactlyOne' | 'SelectAll' | 'SelectAny';

export interface IPlugin {
  id: string;
  name: string;
  description: string;
  image: string;
}

export interface IGroup {
  id: string;
  name: string;
  type: GroupType;
  plugins: IPlugin[];
}

export interface IGroupList {
  group: IGroup[];
  order: OrderType;
}

export interface IInstallStep {
  id: string;
  name: string;
  visible: boolean;
  optionalFileGroups?: IGroupList;
}

export type Direction = 'forward' | 'back';

export interface IStateCallback {
  (stepId: string, groupId: string, plugins: string[]): void;
}

export interface IInstallerInfo {
  moduleName: string;
  image: IHeaderImage;
  select: IStateCallback;
  continue: (direction: Direction) => void;
  cancel: () => void;
}

export interface IInstallerState {
  installSteps: IInstallStep[];
  currentStep: number;
}
