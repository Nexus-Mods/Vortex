export type InstructionType =
  'copy' | 'submodule' | 'generatefile' | 'iniedit'
  | 'unsupported' | 'attribute' | 'setmodtype' | 'error';

export interface IInstruction {
  type: InstructionType;

  path?: string;
  source?: string;
  destination?: string;
  section?: string;
  key?: string;
  value?: string;
  submoduleType?: string;
}

export interface IInstallResult {
  instructions: IInstruction[];
}
