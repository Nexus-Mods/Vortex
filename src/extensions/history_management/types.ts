export interface IHistoryEvent {
  type: string;
  data: any;
  gameId: string;
  reverted?: boolean;
  id?: string;
  timestamp?: number;
}

/**
 * whether an event can be reverted.
 * yes means yes.
 * 'never' means that this type of event can never be reverted
 * 'invalid' means that this type of event can generally be reverted but this
 *   particular one can't - usually because some other event on the same data
 *   makes that impossible
 */
export type Revertability = 'yes' | 'never' | 'invalid';

export interface IHistoryStack {
  /**
   * number of items to remember on the stack
   */
  size: number;
  /**
   * generate a (translated!) description for the entry
   */
  describe: (event: IHistoryEvent) => string;
  /**
   * generate a (translated!) description for the revert action.
   * Please be specific and concise on what exactly this does
   */
  describeRevert: (event: IHistoryEvent) => string;
  /**
   * determine if the event can be reverted
   */
  canRevert: (event: IHistoryEvent) => Revertability;
  /**
   * do revert the specified event
   */
  revert: (event: IHistoryEvent) => Promise<void>;
}
