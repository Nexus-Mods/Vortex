import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";

import type { FeatureFlag, KnownFlagName } from "@vortex/shared/flags";
import { flagVariantSchemas } from "@vortex/shared/flags";
import type { FlagContext, FlagMetricsBucket } from "@vortex/shared/ipc";
import createClient from "openapi-fetch";
import { z } from "zod";

import { log } from "../logging";
import { APP_NAME, BASE_URL, API_KEY, ENVIRONMENT, INTERVAL } from "./constants";
import type { paths, components } from "./schema";

type UnleashContext = {
  appName: string;
  environment: "development" | "production";
  currentTime: string;
  sessionId: string;
  userId?: string;
  properties: {
    appVersion: string;
    os: ReturnType<typeof platform>;
    channel: "beta" | "stable";
  };
};

// NOTE(erri120): injecting our custom unleash context into the query
type CustomPaths = Omit<paths, "/api/frontend"> & {
  readonly "/api/frontend": Omit<paths["/api/frontend"], "get"> & {
    readonly get: Omit<paths["/api/frontend"]["get"], "parameters"> & {
      readonly parameters: {
        readonly query: UnleashContext;
      };
    };
  };
};

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type UnleashClientOptions = {
  cachePath?: string;
  cacheTtlMs?: number;
};

const flagCacheSchema = z.object({
  timestamp: z.number(),
  toggles: z.array(z.unknown()),
});

type FlagCache = z.infer<typeof flagCacheSchema>;

export class UnleashClient {
  readonly #apiClient: ReturnType<typeof createClient<CustomPaths>>;
  readonly #sessionId: string;
  readonly #appVersion: string;
  readonly #channel: "beta" | "stable";
  readonly #cachePath: string | undefined;
  readonly #cacheTtlMs: number;

  #flags: FeatureFlag[] = [];
  #context: FlagContext = {};

  constructor(appVersion: string, options?: UnleashClientOptions) {
    this.#sessionId = randomUUID();
    this.#appVersion = appVersion;
    this.#channel = appVersion.includes("-beta") ? "beta" : "stable";
    this.#cachePath = options?.cachePath;
    this.#cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

    this.#apiClient = createClient({
      baseUrl: BASE_URL,
      headers: {
        Authorization: API_KEY,
        "unleash-sdk": `vortex:${this.#appVersion}`,
        "unleash-appname": APP_NAME,
        "unleash-connection-id": this.#sessionId,
      },
    });
  }

  get flags(): FeatureFlag[] {
    return this.#flags;
  }

  static readonly #maxConsecutiveFailures = 5;

  start(interval: number = INTERVAL, onUpdate?: (flags: FeatureFlag[]) => void): () => void {
    let stopped = false;
    let fetching = false;
    let consecutiveFailures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (): void => {
      const backoffMs = interval * Math.pow(2, consecutiveFailures);
      timer = setTimeout(() => void tick(), backoffMs);
    };

    const tick = async (): Promise<void> => {
      if (stopped || fetching) return;
      fetching = true;

      try {
        this.#flags = await this.fetchFeatureFlags();
        consecutiveFailures = 0;
        onUpdate?.(this.#flags);
      } catch (err) {
        consecutiveFailures++;
        log("warn", "unleash fetch failed", { consecutiveFailures, err });

        if (consecutiveFailures >= UnleashClient.#maxConsecutiveFailures) {
          log("error", "unleash polling disabled after repeated failures");
          fetching = false;
          return;
        }
      } finally {
        fetching = false;
      }

      if (!stopped) schedule();
    };

    const initialLoad = async (): Promise<void> => {
      const cached = await this.#loadCache();
      if (cached !== undefined) onUpdate?.(cached);
      void tick();
    };
    void initialLoad();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  setContext(context: FlagContext): void {
    this.#context = context;
  }

  async postMetrics(bucket: FlagMetricsBucket): Promise<void> {
    const result = await this.#apiClient.POST("/api/frontend/client/metrics", {
      body: {
        appName: APP_NAME,
        sdkVersion: `vortex:${this.#appVersion}`,
        bucket: {
          start: new Date(bucket.start).toISOString(),
          stop: new Date(bucket.stop).toISOString(),
          toggles: bucket.toggles,
        },
      },
    });

    if (result.error) {
      throw new Error(
        `unleash metrics post failed: ${result.error.id} ${result.error.name}: ${result.error.message}`,
      );
    }
  }

  async fetchFeatureFlags(): Promise<FeatureFlag[]> {
    const result = await this.#apiClient.GET("/api/frontend", {
      params: {
        query: this.#createContext(),
      },
      querySerializer: serializeContext,
      headers: {
        accept: "application/json",
      },
    });

    if (result.error) {
      throw new Error(
        `unleash fetch failed: ${result.error.id} ${result.error.name}: ${result.error.message}`,
      );
    }

    if (!result.data) {
      log("debug", "unleash returned no feature flags");
      return [];
    }

    const { toggles } = result.data;
    const flags: FeatureFlag[] = [];
    for (let i = 0; i < toggles.length; i++) {
      const toggle = toggles[i];
      if (!toggle) continue;
      const flag = parseToggle(toggle);
      if (flag) flags.push(flag);
    }

    log("debug", "received feature flags", { num: flags.length });
    void this.#writeCache(toggles as UnleashToggle[]);
    return flags;
  }

  async #writeCache(toggles: UnleashToggle[]): Promise<void> {
    if (!this.#cachePath) return;
    try {
      const cache: FlagCache = { timestamp: Date.now(), toggles };
      await writeFile(this.#cachePath, JSON.stringify(cache), "utf-8");
    } catch (err) {
      log("warn", "failed to write flag cache", { err });
    }
  }

  async #loadCache(): Promise<FeatureFlag[] | undefined> {
    if (!this.#cachePath) return undefined;

    try {
      const raw = await readFile(this.#cachePath, "utf-8");
      const parsed = flagCacheSchema.safeParse(JSON.parse(raw));

      if (!parsed.success) {
        log("debug", "flag cache has unexpected shape, ignoring");
        return undefined;
      }

      const { timestamp, toggles } = parsed.data;
      if (Date.now() - timestamp > this.#cacheTtlMs) {
        log("debug", "flag cache is expired, ignoring");
        return undefined;
      }

      const flags: FeatureFlag[] = [];
      for (const toggle of toggles) {
        const flag = parseToggle(toggle as UnleashToggle);
        if (flag) flags.push(flag);
      }
      log("debug", "replayed feature flags from cache", { num: flags.length });
      return flags;
    } catch (err) {
      log("debug", "failed to read flag cache", { err });
      return undefined;
    }
  }

  #createContext(): UnleashContext {
    return {
      appName: APP_NAME,
      environment: ENVIRONMENT,
      currentTime: new Date().toISOString(),
      sessionId: this.#sessionId,
      userId: this.#context.userId,
      properties: {
        appVersion: this.#appVersion,
        os: platform(),
        channel: this.#channel,
      },
    };
  }
}

function serializeContext(context: UnleashContext): string {
  const params = new URLSearchParams();

  if (context.appName) params.set("appName", context.appName);
  if (context.environment) params.set("environment", context.environment);
  if (context.currentTime) params.set("currentTime", context.currentTime);
  if (context.sessionId) params.set("sessionId", context.sessionId);
  if (context.userId) params.set("userId", context.userId);

  for (const [key, value] of Object.entries(context.properties)) {
    params.set(`properties[${key}]`, value);
  }

  return params.toString();
}

type UnleashToggle = components["schemas"]["frontendApiFeatureSchema"];

function parseToggle({ name, variant }: UnleashToggle): FeatureFlag | undefined {
  const flagName = name as KnownFlagName;
  if (!(flagName in flagVariantSchemas)) {
    log("debug", "unkown feature flag returned by Unleash API", { flagName });
    return undefined;
  }

  const parsedVariant = variant?.payload
    ? parseVariantData(flagName, variant.name, variant.payload.value)
    : undefined;

  const res = {
    name: flagName,
    variant: parsedVariant,
  };

  // eslint-disable-next-lint @typescript-eslint/no-unnecessary-type-assertion
  return res as FeatureFlag;
}

function parseVariantData(
  flagName: string,
  variantName: string,
  value: string,
): FeatureFlag["variant"] | undefined {
  if (!(flagName in flagVariantSchemas)) return undefined;

  const variants = flagVariantSchemas[flagName as KnownFlagName] as Record<string, z.ZodType>;
  const schema = variants[variantName];

  if (!schema) {
    log("debug", "unkown feature flag variant returned by Unleash API", { flagName, variantName });
    return undefined;
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    log("warn", "failed to parse variant data", { flagName, variantName, error: result.error });
    return undefined;
  }

  return { name: variantName, data: result.data } as FeatureFlag["variant"];
}
