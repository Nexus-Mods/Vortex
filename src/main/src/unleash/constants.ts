export const APP_NAME = "Vortex";
export const ENVIRONMENT = process.env.NODE_ENV === "development" ? "development" : "production";
export const INTERVAL = 60 * 1000;

export const BASE_URL = "https://unleash-edge.nexusmods.com";

// NOTE(erri120): Frontend API keys for Unleash. These are not considered secret.
export const API_KEY_DEV =
  "default:development.461fda697b8166c6150598f7ec5a02addd940ad4db4233ef5a1fee0f";
export const API_KEY_PROD =
  "default:production.265480a95fba44ebe22206c64b1a9afaafe5b07b37c05bb2b114b230";
export const API_KEY = ENVIRONMENT === "development" ? API_KEY_DEV : API_KEY_PROD;
