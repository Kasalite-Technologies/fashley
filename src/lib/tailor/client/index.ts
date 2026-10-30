import type { TailorApi } from "./api";
import { createFixtureTailorApi } from "./fixtures";
import { createHttpTailorApi } from "./http";

export * from "./api";
export * from "./errors";
export * from "./keys";
export { createFixtureTailorApi } from "./fixtures";
export { createHttpTailorApi, setTailorTokenProvider, type TailorTokenProvider } from "./http";

/**
 * Fixture mode is explicit and development/test only. Production always uses
 * the HTTP adapter, which fails closed with FEATURE_UNAVAILABLE when the
 * backend is not reachable. There is no silent mock fallback.
 */
export function fixturesEnabled(env: { DEV?: boolean; VITE_TAILOR_FIXTURES?: string }): boolean {
  return env.DEV === true && env.VITE_TAILOR_FIXTURES === "1";
}

export function resolveTailorApi(env: { DEV?: boolean; VITE_TAILOR_FIXTURES?: string }): TailorApi {
  return fixturesEnabled(env) ? createFixtureTailorApi() : createHttpTailorApi();
}

export const isFixtureMode = fixturesEnabled(
  import.meta.env as { DEV?: boolean; VITE_TAILOR_FIXTURES?: string },
);

/** The single fetch boundary for the tailor feature. Components must use this. */
export const tailorApi: TailorApi = resolveTailorApi(
  import.meta.env as { DEV?: boolean; VITE_TAILOR_FIXTURES?: string },
);
