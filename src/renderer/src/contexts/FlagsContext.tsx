import type { FeatureFlag, KnownFlagName } from "@vortex/shared/flags";
import React, {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FlagService } from "../FlagService";

type FlagByName<N extends KnownFlagName> = Extract<FeatureFlag, { name: N }>;

export interface IFlagsContext {
  flags: ReadonlyMap<KnownFlagName, FeatureFlag>;
  getFlag<N extends KnownFlagName>(name: N): FlagByName<N> | undefined;
}

const defaultValue: IFlagsContext = {
  flags: new Map(),
  getFlag: () => undefined,
};

const FlagsContext = createContext<IFlagsContext>(defaultValue);

export interface IFlagsProviderProps {
  children: ReactNode;
}

export const FlagsProvider: FC<IFlagsProviderProps> = ({ children }) => {
  const [flags, setFlags] = useState<ReadonlyMap<KnownFlagName, FeatureFlag>>(
    () => FlagService.instance.flags,
  );

  useEffect(() => {
    return FlagService.instance.subscribe(() => {
      setFlags(FlagService.instance.flags);
    });
  }, []);

  const getFlag = useCallback(
    <N extends KnownFlagName>(name: N): FlagByName<N> | undefined =>
      FlagService.instance.getFlag(name),
    // flags is listed so getFlag referential identity changes when flags do,
    // ensuring consumers that memoize on getFlag re-evaluate after a push.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [flags],
  );

  const contextValue = useMemo(() => ({ flags, getFlag }), [flags, getFlag]);

  return <FlagsContext.Provider value={contextValue}>{children}</FlagsContext.Provider>;
};

export function useFlagsContext(): IFlagsContext {
  return useContext(FlagsContext);
}

export function useFlag<N extends KnownFlagName>(name: N): FlagByName<N> | undefined {
  return useFlagsContext().getFlag(name);
}
