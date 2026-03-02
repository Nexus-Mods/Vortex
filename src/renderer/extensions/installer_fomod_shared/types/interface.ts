export interface IHeaderImage {
  path: string;
  showFade: boolean;
  height: number;
}

export type OrderType = "AlphaAsc" | "AlphaDesc" | "Explicit";

export type GroupType =
  | "SelectAtLeastOne"
  | "SelectAtMostOne"
  | "SelectExactlyOne"
  | "SelectAll"
  | "SelectAny";

export type PluginType =
  | "Required"
  | "Optional"
  | "Recommended"
  | "NotUsable"
  | "CouldBeUsable";

export interface IPlugin {
  id: number;
  selected: boolean;
  preset: boolean;
  name: string;
  description: string;
  image: string;
  type: PluginType;
  conditionMsg?: string;
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

export type Direction = "forward" | "back";

export interface IStateParameters {
  stepId: number;
  groupId: number;
  plugins: number[];
}

export type StateCallback = (parameters: IStateParameters) => void;

export interface IInstallerInfo {
  moduleName: string;
  image: IHeaderImage;
  dataPath: string;
  select?: StateCallback;
  cont?: (direction: Direction, currentStepId: number) => void;
  cancel?: () => void;
}

export interface IInstallerInfoState {
  moduleName: string;
  image: IHeaderImage;
  dataPath: string;
}

export interface IInstallerState {
  installSteps: IInstallStep[];
  currentStep: number;
}

export interface IReportError {
  title: string;
  message: string;
  details: string;
}

export type IChoices =
  | {
      name: string;
      groups: {
        name: string;
        choices: {
          name: string;
          idx: number;
        }[];
      }[];
    }[]
  | undefined;

export type IChoiceType = {
  type: string;
  options: IChoices;
};

export interface IFOMODStateInstance {
  info: IInstallerInfoState | undefined;
  state: IInstallerState | undefined;
}

export interface IFOMODStateDialog {
  instances?: { [key: string]: IFOMODStateInstance };
  activeInstanceId?: string | null;
}

export interface IFOMODStateInstaller {
  dialog?: IFOMODStateDialog;
}

export interface IFOMODState {
  installer?: IFOMODStateInstaller;
}

export interface IPluginState {
  pluginList: { [key: string]: IPlugin };
}
