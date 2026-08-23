import type { IProfile } from "./IProfile";

export interface IProfileFeatureChoice {
  value: string;
  label: string;
}

export interface IProfileFeature {
  id: string;
  icon: string;
  label: string;
  // the type of the value.
  // This can be anything but only supported types will provide generic means to edit
  // and custom rendering
  // as of Vortex 1.4, only 'boolean' and 'text' have such handling, everything else will
  // be displayed with value.toString() and not editable (unless your extension provides something)
  type: string;
  description: string;
  supported: () => boolean;
  choices?: (profile: IProfile) => IProfileFeatureChoice[] | PromiseLike<IProfileFeatureChoice[]>;
  formatValue?: (value: unknown) => string;
  namespace?: string;
}
