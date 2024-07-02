export type LockedState = true | false | 'true' | 'false' | 'always' | 'never';
export type LoadOrder = ILoadOrderEntry[];

export interface IItemRendererProps {
  // The actual item we want to render.
  loEntry: ILoadOrderEntry;

  // Tells the item renderer whether to display checkboxes or not.
  displayCheckboxes: boolean;

  // Used to display a small tooltip icon next to the invalid mod entry
  //  describing the issue directly on the mod entry in the LO page.
  invalidEntries?: IInvalidResult[];

  // Function components cannot be given refs, which means that DnD
  //  will not work when using the Vortex API's DraggableItem without
  //  forwarding the ref to the itemRenderer.
  setRef?: (ref: any) => void;
}

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
  //  It's extremely important to set this property for entries
  //  generated from mods that are actively managed by Vortex; forgetting
  //  to do so can result in unexpected behaviour (such as entries not
  //  being included in a collection)
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
   * Defaults to true unless specified otherwise.
   *  The load order will get cleared upon purge by default.
   * Set this to false if you want to preserve the load order.
   */
  clearStateOnPurge?: boolean;

  /**
   * Extension developers are able to provide usage instructions to be displayed
   *  in the load order page alongside the load order panel.
   *  Default instructions will be provided if custom instructions aren't provided.
   */
  usageInstructions?: string | React.ComponentType<{}>;

  /**
   * Extension developers are able to provide a custom item renderer for the
   *  load order page. This will get rendered instead of the default one.
   */
  customItemRenderer?: React.ComponentType<{ className?: string, item: IItemRendererProps, forwardedRef?: (ref: any) => void }>;

  /**
   * By default the FBLO extension will attempt to automatically generate the data
   *  required when publishing/exporting a collection; the noCollectionGeneration
   *  property allows game extensions to opt out of this functionality, which is useful
   *  if/when the default generation logic is insufficient for a particular game.
   */
  noCollectionGeneration?: boolean;

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
   *
   *  @param prev the load order array state before serialization.
   */
  serializeLoadOrder: (loadOrder: LoadOrder, prev: LoadOrder) => Promise<void>;

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
   *  @returns An object containing a deserialized array of LO entries.
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
   * @param prev the load order array state before the serialization/deserialization
   *             functionality has been executed.
   *
   * @param current the load order array state we either want to serialize, or have
   *                deserialized and want to ensure its valid.
   *
   * @returns a validation result specifying any invalid entries - these will be displayed
   *          to the user in the load order page (accompanied by an error notification)
   *          validation passes if the validate function call returns undefined, signifying
   *          that no invalid entries have been found.
   *
   */
  validate: (prev: LoadOrder, current: LoadOrder) => Promise<IValidationResult>;

  /**
   * Predicate to allow the game extension to decide wheter the load order page should be visible
   *  (In case the game extension wants to hide or switch between different LO management logic)
   * @returns true if the load order page should be visible, false otherwise.
   */
  condition?: () => boolean;
}

export interface ILoadOrderGameInfoExt extends ILoadOrderGameInfo {
  // The things I do to reduce complexity for extension developers...
  //  (and to block users from sending us reports which we can do nothing about)
  isContributed: boolean;
}

export class LoadOrderValidationError extends Error {
  private mValidationRes: IValidationResult;
  private mLoadOrder: LoadOrder;
  constructor(validationRes: IValidationResult, loadOrder: LoadOrder) {
    super('Invalid Load Order');
    this.name = 'LoadOrderValidationError';
    this.mValidationRes = validationRes;
    this.mLoadOrder = loadOrder;
  }

  public get validationResult(): IValidationResult {
    return this.mValidationRes;
  }

  public get loadOrder(): LoadOrder {
    return this.mLoadOrder;
  }

  public get loadOrderEntryNames(): string {
    const lo = this.mLoadOrder.filter(entry => !!entry)
                              .map(entry => entry.name)
                              .join('\n');
    return lo;
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
