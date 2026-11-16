import { getErrorMessageOrDefault, isPromiseLike } from "@vortex/shared";

import type { ITableAttribute } from "@/types/ITableAttribute";
import type { TFunction } from "@/util/i18n";
import { log } from "@/util/log";

import type { IModWithState } from "../../types/IModProps";

export type ModsById = { [id: string]: IModWithState };

/** A registered column's value for one mod, as last worked out. */
export interface IRegisteredValue {
  /** The value; while a new one is worked out asynchronously, the one before it. */
  readonly value: unknown;
  /** Settles once a value worked out asynchronously is in `value`; none once it is. */
  readonly pending?: PromiseLike<void>;
}

interface IEntry extends IRegisteredValue {
  value: unknown;
  pending?: PromiseLike<void>;
  /** The mod it was worked out for, so a changed mod works it out again. */
  mod: IModWithState;
  /** For a volatile attribute, the mods it was worked out with; otherwise none. */
  mods: ModsById | undefined;
  /** The attribute's generation it was worked out in, which `invalidate` moves on. */
  generation: number;
}

/** Logs an extension's failure for a cell, as the legacy table does, and carries on. */
export const logAttributeFailure = (
  message: string,
  attribute: ITableAttribute,
  mod: IModWithState,
  err: unknown,
) =>
  log("error", message, {
    attribute: attribute.id,
    row: mod.id,
    error: getErrorMessageOrDefault(err),
  });

const CALC_FAILED = "failed to calculate attribute value";

/**
 * Registered columns' `calc` values for every mod, kept as the legacy table keeps them, so a row
 * scrolled out and back in, or searched, doesn't work its values out again. A value is worked
 * out again when its mod changes, when `invalidate` says the data outside the mods it's from
 * did, or, for a volatile attribute, when any mod does.
 */
export class RegisteredValues {
  private readonly mEntries = new Map<string, Map<string, IEntry>>();
  private readonly mGenerations = new Map<string, number>();
  private readonly mListeners = new Set<() => void>();
  private mRevision = 0;
  private readonly mT: TFunction;

  constructor(t: TFunction) {
    this.mT = t;
  }

  /**
   * An attribute's value for a mod, worked out only if it hasn't been yet.
   *
   * @param mods All the mods, which a volatile attribute's value is worked out again for.
   */
  public get(attribute: ITableAttribute, mod: IModWithState, mods: ModsById): IRegisteredValue {
    return this.lookup(attribute, mod, attribute.isVolatile ? mods : undefined);
  }

  /**
   * An attribute's value for a mod as a search sees it: as last worked out, whichever mods a
   * volatile one was worked out with, as a search has no mods to give.
   */
  public forSearch(attribute: ITableAttribute, mod: IModWithState): IRegisteredValue {
    return this.lookup(attribute, mod, this.mEntries.get(attribute.id)?.get(mod.id)?.mods);
  }

  /** Has an attribute's values worked out again, as they're next asked for. */
  public invalidate(attributeId: string) {
    this.mGenerations.set(attributeId, this.generation(attributeId) + 1);
    this.changed();
  }

  /**
   * Drops the values of mods that are gone, and volatile ones worked out with other mods, which
   * would be worked out again anyway, so it keeps no more than the mods shown.
   */
  public prune(mods: ModsById) {
    for (const byMod of this.mEntries.values()) {
      for (const [modId, entry] of byMod) {
        if (mods[modId] === undefined || (entry.mods !== undefined && entry.mods !== mods)) {
          byMod.delete(modId);
        }
      }
    }
  }

  /** Counts its values' changes: each `invalidate`, and each asynchronous value as it's ready. */
  public readonly revision = () => this.mRevision;

  /** Calls `listener` as its values change, until the function it returns is called. */
  public readonly subscribe = (listener: () => void) => {
    this.mListeners.add(listener);
    return () => {
      this.mListeners.delete(listener);
    };
  };

  private changed() {
    this.mRevision += 1;
    this.mListeners.forEach((listener) => listener());
  }

  private generation(attributeId: string) {
    return this.mGenerations.get(attributeId) ?? 0;
  }

  private lookup(
    attribute: ITableAttribute,
    mod: IModWithState,
    mods: ModsById | undefined,
  ): IRegisteredValue {
    let byMod = this.mEntries.get(attribute.id);
    if (byMod === undefined) {
      byMod = new Map();
      this.mEntries.set(attribute.id, byMod);
    }

    const generation = this.generation(attribute.id);
    const last = byMod.get(mod.id);
    if (last?.mod === mod && last.mods === mods && last.generation === generation) {
      return last;
    }

    const entry: IEntry = { mod, mods, generation, value: undefined };
    const result = this.calc(attribute, mod);
    if (isPromiseLike(result)) {
      // The last value stays until this one's ready, as the legacy table keeps it.
      entry.value = last?.value;
      entry.pending = result.then(
        (value) => {
          entry.value = value;
          entry.pending = undefined;
          this.changed();
        },
        (err: unknown) => {
          logAttributeFailure(CALC_FAILED, attribute, mod, err);
          entry.pending = undefined;
          this.changed();
        },
      );
    } else {
      entry.value = result;
    }
    byMod.set(mod.id, entry);
    return entry;
  }

  private calc(attribute: ITableAttribute, mod: IModWithState): unknown {
    try {
      return attribute.calc?.(mod, this.mT);
    } catch (err) {
      logAttributeFailure(CALC_FAILED, attribute, mod, err);
      return undefined;
    }
  }
}
