import { randomUUID } from "node:crypto";
import { platform } from "node:os";

import type { FeatureFlag, KnownFlagName } from "@vortex/shared/flags";
import { flagVariantSchemas } from "@vortex/shared/flags";
import { app } from "electron/main";
import createClient from "openapi-fetch";
import type { z } from "zod";

import { log } from "../logging";
import { APP_NAME, BASE_URL, API_KEY, ENVIRONMENT } from "./constants";
import type { paths, components } from "./schema";

type UnleashContext = {
  appName: string;
  appVersion: string;
  environment: "development" | "production";
  channel: "beta" | "stable";
  currentTime: string;
  os: ReturnType<typeof platform>;
  sessionId: string;
  userId?: string;
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

export class UnleashClient {
  readonly #apiClient: ReturnType<typeof createClient<CustomPaths>>;
  readonly #sessionId: string;
  readonly #appVersion: string;
  readonly #channel: "beta" | "stable";

  #flags: FeatureFlag[];

  constructor() {
    this.#apiClient = createClient({
      baseUrl: BASE_URL,
      headers: {
        Authorization: API_KEY,
      },
    });

    this.#sessionId = randomUUID();
    this.#appVersion = app.getVersion();
    this.#channel = this.#appVersion.includes("-beta") ? "beta" : "stable";
  }

  get flags(): FeatureFlag[] {
    return this.#flags;
  }

  static readonly #maxConsecutiveFailures = 5;

  start(interval: number): () => void {
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
        this.#flags = await this.#fetchFeatureFlags();
        consecutiveFailures = 0;
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

    void tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  async #fetchFeatureFlags(): Promise<FeatureFlag[]> {
    const result = await this.#apiClient.GET("/api/frontend", {
      params: {
        query: this.#createContext(),
      },
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

    const flags: FeatureFlag[] = [];
    const { toggles } = result.data;
    for (let i = 0; i <= toggles.length; i++) {
      const toggle = toggles[i];
      const flag = parseToggle(toggle);
      if (flag) flags.push(flag);
    }

    log("debug", "received feature flags", { num: flags.length });
    return flags;
  }

  #createContext(): UnleashContext {
    return {
      appName: APP_NAME,
      appVersion: app.getVersion(),
      environment: ENVIRONMENT,
      currentTime: new Date().toISOString(),
      os: platform(),
      sessionId: this.#sessionId,
      channel: this.#channel,
      // TODO: userId
    };
  }
}

type UnleashToggle = components["schemas"]["frontendApiFeatureSchema"];

function parseToggle({ name, variant }: UnleashToggle): FeatureFlag | undefined {
  const flagName = name as KnownFlagName;
  if (!(flagName in flagVariantSchemas)) {
    log("warn", "unkown feature flag returned by Unleash API", { flagName });
    return undefined;
  }

  return {
    name: flagName,
    variant: variant?.payload
      ? parseVariantData(flagName, variant.name, variant.payload.value)
      : undefined,
  };
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
    log("warn", "unkown feature flag variant returned by Unleash API", { flagName, variantName });
    return undefined;
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    log("warn", "failed to parse variant data", { flagName, variantName, error: result.error });
    return undefined;
  }

  return { name: variantName, data: result.data } as FeatureFlag["variant"];
}
