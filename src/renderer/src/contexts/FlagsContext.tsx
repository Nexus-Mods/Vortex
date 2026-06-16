import type { FeatureFlag, KnownFlagName } from "@vortex/shared/flags";
import type { FlagMetricsBucket } from "@vortex/shared/ipc";
import React, {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const METRICS_INTERVAL_MS = 60_000;

type EvalEntry = { yes: number; no: number; variants: Record<string, number> };
type EvalCounts = Record<string, EvalEntry>;

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
  const [flags, setFlags] = useState<ReadonlyMap<KnownFlagName, FeatureFlag>>(() => new Map());
  const evalRef = useRef<EvalCounts>({});
  const bucketStartRef = useRef<number>(Date.now());

  useEffect(() => {
    return window.api.featureFlags.onSynchronize((updated) => {
      setFlags(new Map(updated.map((f) => [f.name, f])));
    });
  }, []);

  const flush = useCallback((): void => {
    const counts = evalRef.current;
    const start = bucketStartRef.current;
    const stop = Date.now();

    evalRef.current = {};
    bucketStartRef.current = stop;

    if (Object.keys(counts).length === 0) return;

    const toggles: FlagMetricsBucket["toggles"] = {};
    for (const [name, entry] of Object.entries(counts)) {
      toggles[name] = {
        yes: entry.yes,
        no: entry.no,
        ...(Object.keys(entry.variants).length > 0 && { variants: entry.variants }),
      };
    }
    window.api.featureFlags.reportMetrics({ start, stop, toggles });
  }, []);

  useEffect(() => {
    const timer = setInterval(flush, METRICS_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      flush();
    };
  }, [flush]);

  const getFlag = useCallback(
    <N extends KnownFlagName>(name: N): FlagByName<N> | undefined => {
      const flag = flags.get(name) as FlagByName<N> | undefined;
      const entry = (evalRef.current[name] ??= { yes: 0, no: 0, variants: {} });
      if (flag !== undefined) {
        entry.yes++;
        if (flag.variant) {
          entry.variants[flag.variant.name] = (entry.variants[flag.variant.name] ?? 0) + 1;
        }
      } else {
        entry.no++;
      }
      return flag;
    },
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
