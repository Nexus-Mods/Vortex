export interface ICapacityInfo {
  rootPath: string;
  totalFreeBytes: number;
  totalNeededBytes?: number;
  hasCalculationErrors?: boolean;
}

export type ModsCapacityMap = { [modId: string]: number };