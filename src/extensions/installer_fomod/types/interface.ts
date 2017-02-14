export interface IHeaderImage {
  path: string;
  showFade: boolean;
  height: number;
}

export type OrderType = 'AlphaAsc' | 'AlphaDesc' | 'Explicit';

export type GroupType =
  'SelectAtLeastOne' | 'SelectAtMostOne' | 'SelectExactlyOne' | 'SelectAll' | 'SelectAny';

export interface IPlugin {
  id: number;
  selected: boolean;
  name: string;
  description: string;
  image: string;
}

export interface IGroup {
  id: number;
  name: string;
  type: GroupType;
  options: IPlugin[];
}

export interface IGroupList {
  group: IGroup[];
  order: OrderType;
}

export interface IInstallStep {
  id: number;
  name: string;
  visible: boolean;
  optionalFileGroups?: IGroupList;
}

export type Direction = 'forward' | 'back';

export interface IStateParameters {
  stepId: number;
  groupId: number;
  plugins: number[];
}

export interface IStateCallback {
  (parameters: IStateParameters): void;
}

export interface IInstallerInfo {
  moduleName: string;
  image: IHeaderImage;
  select: IStateCallback;
  cont: (direction: Direction) => void;
  cancel: () => void;
}

export interface IInstallerState {
  installSteps: IInstallStep[];
  currentStep: number;
}
