import { ITool } from './ITool';

export interface IDiscoveredTool extends ITool {
  // path to the tool (including the executable name!)
  path: string;
  hidden: boolean;
  custom: boolean;
  // working directory can be empty in which case the parent dir of the executable is used
  workingDirectory?: string;
  timestamp?: number;
}
