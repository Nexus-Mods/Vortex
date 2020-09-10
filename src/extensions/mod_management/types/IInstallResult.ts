import { IRule } from './IMod';

export type InstructionType =
  'copy' | 'mkdir' | 'submodule' | 'generatefile' | 'iniedit'
  | 'unsupported' | 'attribute' | 'setmodtype' | 'error'
  | 'rule';

export interface IInstruction {
  type: InstructionType;

  path?: string;
  source?: string;
  destination?: string;
  section?: string;
  key?: string;
  value?: string;
  submoduleType?: string;
  data?: string | Buffer;
  rule?: IRule;
}

export interface IInstallResult {
  instructions: IInstruction[];
}
