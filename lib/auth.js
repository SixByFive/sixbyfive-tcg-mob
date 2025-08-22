// app/lib/auth.js
import * as SecureStore from "expo-secure-store";
const KEY = "sb5_auth_token";
export async function setToken(t){ if(t) await SecureStore.setItemAsync(KEY, t); }
export async function getToken(){ try { return await SecureStore.getItemAsync(KEY); } catch { return null; } }
export async function clearToken(){ try { await SecureStore.deleteItemAsync(KEY); } catch {} }
