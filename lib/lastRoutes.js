// lib/lastRoutes.js
//
// ADDED (2026-02-18)
//
// Purpose:
// - Single source of truth for "Continue where you left off" routes.
// - Uses expo-secure-store.
// - Avoids rewriting the same value repeatedly.

import * as SecureStore from "expo-secure-store";

export const LAST_BINDER_ROUTE_KEY = "sbf_last_binder_route_v1";
export const LAST_SEARCH_ROUTE_KEY = "sbf_last_search_route_v1";
export const LAST_PROFILE_ROUTE_KEY = "sbf_last_profile_route_v1";

function cleanString(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

export async function setLastRoute(key, route) {
  const next = cleanString(route);
  if (!next) return;

  try {
    const prev = await SecureStore.getItemAsync(key);
    if (prev === next) return; // no-op if unchanged
    await SecureStore.setItemAsync(key, next);
  } catch {
    // Non-fatal
  }
}
