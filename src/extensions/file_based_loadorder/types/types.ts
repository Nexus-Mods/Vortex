import * as Promise from 'bluebird';

export type LockedState = 'true' | 'false' | 'always' | 'never';
export type LoadOrder = ILoadOrderEntry[];

export interface ILoadOrderEntry<T = any> {
  // An arbitrary unique id for the load order item
  id: string;

  // Is this entry enabled ?
  enabled: boolean;

  // The entry's display name.
  name: string;

  // Is the entry locked into a certain position ?
  //  This only affects how the LO page renders the
  //  entry. The load order API will not enforce positions.
  locked?: LockedState;

  // The id of the mod to which this LO entry belongs.
  //  can be left undefined if the entry is not managed by Vortex.
  modId?: string;

  // Custom data passed along with the load order entry
  data?: T;
}

export interface IInvalidResult {
  // The unique identifier of the load order entry that
  //  failed validation.
  id: string;

  // The reason why the load order entry is invalid.
  reason: string;
}

export interface IValidationResult {
  // Stores the invalid results (if any); the validation
  //  functor can provide a list of load order entry id's
  //  complemented with the reason why validation had failed
  //  which will be displayed to the user. The LO API will assume
  //  that the validation had passed successfully if no invalid
  //  results are provided.
  invalid: IInvalidResult[];
}

export interface ILoadOrderGameInfo {
  // The domain gameId for this entry.
  gameId: string;

  /**
   * Defaults to true unless specified otherwise.
   * Will add a checkbox for each load order entry.
   * The checkboxes will control the LO entry's "enabled" property.
   */
  toggleableEntries?: boolean;

  /**
   * Extension developers are able to provide usage instructions to be displayed
   *  in the load order page alongside the load order panel.
   *  Default instructions will be provided if custom instructions aren't provided.
   */
  usageInstructions?: string;

  /**
   * The load order page will call this functor whenever it is necessary
   *  to write a change to disk. It is up to the game extension developer to decide
   *  where/how to store this information,. Obviously - the data should be
   *  formatted in a way where it is easily deserializeable by the
   *  deserializeLoadOrder functor)
   *
   *  This functor will always be called AFTER the validate functor had
   *   a chance to ensure that any changes made to the LO are not invalid.
   *   (will not be called at all if change is not valid)
   *
   *  Expect the functor to be called whenever a load order change is
   *   applied (drag-drop, props update, etc.)
   *
   *  @param loadOrder An array consisting of load order objects which we want stored on disk.
   *    Please note that the load order array sent to the game extension's
   *    serialize functor will be sorted in the expected load order
   */
  serializeLoadOrder: (loadOrder: LoadOrder) => Promise<void>;

  /**
   * Game extension should parse the Load Order file stored on disk using the
   *  same format used when serializing it in serializeLoadOrder and provide
   *  a populated load order array in the correct order.
   *
   * Please note that the validate functor will be called to verify the deserialized
   *  load order object immediately after the deserialization functor completes its
   *  operation to ensure that any newly inserted element (through manual intervention or
   *  through the game's interface) is valid.
   *
   * If for any reason the change is _not_ valid or the deserialization operation had failed,
   *  the load order will be reverted and locked until the the error is handled by
   *  the user. An error notification _will_ be raised notifying the user of any errors.
   *
   * Deserialization will be called:
   *  - As soon as the Load Order page is mounted/loaded.
   *
   *  - After the user exits a configured tool or the game to regenerate the LO
   *    in case the user had changed it while using said tool/game
   *
   *  - If the user changes profiles.
   *
   *  - On deploy/purge to ensure the user hadn't modified the mod list manually
   *    or through an external tool.
   *  @returns An object containing a deserialized map of LO entries.
   */
  deserializeLoadOrder: () => Promise<LoadOrder>;

  /**
   * Called to validate a load order object - it is the game extension's
   *  responsibility to ensure that the object is formatted correctly and that
   *  it does not breach any set rules (e.g. a locked entry had been moved to an invalid
   *  position)
   *
   * Functor is called:
   *
   * - Before serialization occurs to ensure we don't serialize and write invalid LO
   *
   * - After deserialization to ensure any invalid user tampering or changes made through the
   *   game UI is validated and removed if necessary.
   *
   */
  validate: (prev: LoadOrder, current: LoadOrder) => Promise<IValidationResult>;
}

export class LoadOrderValidationError extends Error {
  private mValidationRes: IValidationResult;
  private mLoadOrder: string[];
  constructor(validationRes: IValidationResult, loadOrder: LoadOrder) {
    super('Invalid Load Order');
    this.name = 'LoadOrderValidationError';
    this.mValidationRes = validationRes;
    this.mLoadOrder = loadOrder.map(entry => entry.name);
  }

  public get validationResult(): IValidationResult {
    return this.mValidationRes;
  }

  public get loadOrder(): string {
    return this.mLoadOrder.filter(entry => !!entry)
                          .join('\n');
  }
}

export class LoadOrderSerializationError extends Error {
  private mLoadOrder: string[];
  constructor(loadOrder: LoadOrder) {
    super('Failed to serialize load order');
    this.name = 'LoadOrderSerializationError';
    this.mLoadOrder = loadOrder.map(entry => entry.name);
  }

  public get loadOrder(): string {
    return this.mLoadOrder.join('\n');
  }
}
