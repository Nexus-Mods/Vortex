import type { ILoadOrderEntry, IState } from "../../../types/api";
import { nameof } from "../../../util/nameof";

type IStatePersistent = IState["persistent"];

export type VortexLoadOrderStorage<T = any> = VortexLoadOrderEntry<T>[];
export type VortexLoadOrderEntry<T = any> = ILoadOrderEntry<T>;

interface IStatePersistentWithLoadOrder<T = any> extends IStatePersistent {
  loadOrder: {
    [profileId: string]: VortexLoadOrderStorage<T>;
  };
}

export const hasPersistentLoadOrder = <T = any>(
  statePersistent: IStatePersistent,
): statePersistent is IStatePersistentWithLoadOrder<T> =>
  nameof<IStatePersistentWithLoadOrder<T>>("loadOrder") in statePersistent;
