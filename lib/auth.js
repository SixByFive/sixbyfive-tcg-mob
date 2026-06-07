// app/lib/auth.js
import * as SecureStore from "expo-secure-store";

const ACCESS_KEY  = "sb5_auth_token";
const REFRESH_KEY = "sb5_refresh_token";

export async function setToken(t)        { if (t) await SecureStore.setItemAsync(ACCESS_KEY,  t); }
export async function getToken()         { try { return await SecureStore.getItemAsync(ACCESS_KEY);  } catch { return null; } }
export async function clearToken()       { try { await SecureStore.deleteItemAsync(ACCESS_KEY);  } catch {} }

export async function setRefreshToken(t) { if (t) await SecureStore.setItemAsync(REFRESH_KEY, t); }
export async function getRefreshToken()  { try { return await SecureStore.getItemAsync(REFRESH_KEY); } catch { return null; } }
export async function clearRefreshToken(){ try { await SecureStore.deleteItemAsync(REFRESH_KEY); } catch {} }
