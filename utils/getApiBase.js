// utils/getApiBase.js
// Returns the REST API base URL, mirroring the Apollo client's dev/prod switch.
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra || {};
const DEV_MODE = !!extra.EXPO_PUBLIC_DEV_MODE;

export function getApiBase() {
  if (DEV_MODE) return "http://10.0.2.2:4010";
  return extra.EXPO_PUBLIC_ASSET_BASE_URL || "https://backendtcg.sixbyfive.com";
}

export function getSiteOrigin() {
  return extra.EXPO_PUBLIC_SITE_ORIGIN || "https://tcg.sixbyfive.com";
}
