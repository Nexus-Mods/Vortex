import { ITool } from './ITool';

export interface IDiscoveredTool extends ITool {
  // path to the tool (including the executable name!)
  path: string;
  hidden: boolean;
  custom: boolean;
  workingDirectory: string;
}
