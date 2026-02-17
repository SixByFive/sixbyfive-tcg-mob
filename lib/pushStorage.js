// app/lib/pushStorage.js

import * as SecureStore from "expo-secure-store";

const KEY = "sbf_push_token_v1";

export async function savePushTokenLocal({ userId, token }) {
  try {
    const payload = {
      userId: userId ? String(userId) : "",
      token: token ? String(token) : "",
      savedAt: Date.now(),
    };
    await SecureStore.setItemAsync(KEY, JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
}

export async function getPushTokenLocal() {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export async function clearPushTokenLocal() {
  try {
    await SecureStore.deleteItemAsync(KEY);
    return true;
  } catch (_) {
    return false;
  }
}
