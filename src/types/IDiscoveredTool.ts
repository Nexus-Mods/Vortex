import { ITool } from './ITool';

export interface IDiscoveredTool extends ITool {
  path: string;
  hidden: boolean;
  parameters: string[];
  custom: boolean;
  currentWorkingDirectory: string;
}
