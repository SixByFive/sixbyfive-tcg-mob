// app/lib/push.js
//
// UPDATED (2026-02-17)
// CHANGES (this revision):
// - ADD: GraphQL mutation for registerExpoPushToken
// - ADD: bootRegisterPushTokenAsync(apolloClient)
//        - registers Expo token with backend (auth required)
// - ADD: bootPushAsync(apolloClient)
//        - convenience: auto-prompt + register token on app open
// - KEEP: Allow permission prompting on emulators/AVD
// - KEEP: Only fetch Expo push token on real device (Device.isDevice guard remains there)
// - KEEP: Prompt once per app version via SecureStore
// - KEEP: Local prefs + Android channel vibration handling
//
// NOTES:
// - You cannot enable OS permission by default; you can only request it.
// - Android < 13 (API < 33) often won't show a prompt (permission granted by default).
// - iOS prompt shows once per install; after that, user must change in system settings.
//

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// ✅ ADD: GraphQL helper
import { gql } from "@apollo/client";

/* =============================================================================
   Local preferences (SecureStore)
============================================================================= */

const PREFS_KEY = "sbf_push_prefs_v1";
const PROMPTED_VERSION_KEY = "sbf_push_prompted_version_v1";

// In-memory cache (so handler can read sync-ish)
let _prefs = {
  enabled: true,
  sound: true,
  vibration: true,
};

let _hydrated = false;

async function hydratePrefsOnce() {
  if (_hydrated) return _prefs;

  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _prefs = {
        enabled: typeof parsed?.enabled === "boolean" ? parsed.enabled : true,
        sound: typeof parsed?.sound === "boolean" ? parsed.sound : true,
        vibration:
          typeof parsed?.vibration === "boolean" ? parsed.vibration : true,
      };
    }
  } catch (_) {
    // ignore, keep defaults
  } finally {
    _hydrated = true;
  }

  return _prefs;
}

export async function getPushPrefsAsync() {
  await hydratePrefsOnce();
  return { ..._prefs };
}

export async function setPushPrefsAsync(next) {
  await hydratePrefsOnce();

  _prefs = {
    ..._prefs,
    ...Object.fromEntries(
      Object.entries(next || {}).filter(([_, v]) => typeof v === "boolean"),
    ),
  };

  try {
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(_prefs));
  } catch (e) {
    console.log("[push] setPushPrefsAsync SecureStore error", e?.message || e);
  }

  return { ..._prefs };
}

/* =============================================================================
   Foreground notification behavior
============================================================================= */

Notifications.setNotificationHandler({
  handleNotification: async () => {
    await hydratePrefsOnce();

    if (!_prefs.enabled) {
      return {
        shouldShowList: false,
        shouldShowBanner: false,
        shouldSetBadge: false,
        shouldPlaySound: false,
      };
    }

    return {
      shouldShowList: true,
      shouldShowBanner: true,
      shouldSetBadge: true,
      shouldPlaySound: !!_prefs.sound,
    };
  },
});

/* =============================================================================
   Permissions + Android channel
============================================================================= */

export async function ensurePushPermissionsAsync() {
  try {
    await hydratePrefsOnce();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: _prefs.vibration ? [0, 250, 250, 250] : undefined,
        enableVibrate: !!_prefs.vibration,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    console.log("[push] getPermissionsAsync:", existing);

    if (existing.status === "granted") {
      return { granted: true, status: "granted" };
    }

    const req = await Notifications.requestPermissionsAsync();
    console.log("[push] requestPermissionsAsync:", req);

    return { granted: req.status === "granted", status: req.status };
  } catch (e) {
    console.log("[push] permissions error", e?.message || e);
    return { granted: false, status: "error" };
  }
}

/* =============================================================================
   Auto-prompt on app open (once per app version)
============================================================================= */

function getAppVersionSafe() {
  return (
    Constants?.expoConfig?.version || Constants?.manifest?.version || "0.0.0"
  );
}

export async function maybeAutoPromptPushPermissionsOnOpenAsync() {
  try {
    await hydratePrefsOnce();

    // If user turned notifications off in-app, don't prompt.
    if (!_prefs.enabled) {
      console.log("[push] auto-prompt skipped: disabled_in_app");
      return { prompted: false, status: "disabled_in_app" };
    }

    // Always configure channel (safe no-op on iOS)
    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("messages", {
          name: "Messages",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: _prefs.vibration ? [0, 250, 250, 250] : undefined,
          enableVibrate: !!_prefs.vibration,
        });
      } catch (e) {
        console.log("[push] channel config error", e?.message || e);
      }
    }

    const currentVersion = getAppVersionSafe();
    const lastPromptedVersion =
      await SecureStore.getItemAsync(PROMPTED_VERSION_KEY);

    console.log("[push] auto-prompt check:", {
      currentVersion,
      lastPromptedVersion,
      isDevice: Device.isDevice,
      platform: Platform.OS,
    });

    // If we already prompted for this app version, don’t prompt again.
    if (lastPromptedVersion === currentVersion) {
      const existing = await Notifications.getPermissionsAsync();
      console.log("[push] auto-prompt skipped: already_prompted_this_version", {
        status: existing?.status,
      });
      return {
        prompted: false,
        status: existing?.status || "unknown",
      };
    }

    // Mark as prompted BEFORE requesting (prevents loops)
    await SecureStore.setItemAsync(PROMPTED_VERSION_KEY, currentVersion);

    const res = await ensurePushPermissionsAsync();
    console.log("[push] auto-prompt result:", res);

    return { prompted: true, status: res?.status || "unknown" };
  } catch (e) {
    console.log("[push] auto-prompt error", e?.message || e);
    return { prompted: false, status: "error" };
  }
}

/* =============================================================================
   Token (device-only)
============================================================================= */

export async function getExpoPushTokenAsync() {
  try {
    // Token fetch should remain device-only (Expo push tokens can be unreliable on emulators)
    if (!Device.isDevice) return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token?.data || null;
  } catch (e) {
    console.log("[push] token error", e?.message || e);
    return null;
  }
}

export function addNotificationTapListener(onTap) {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data = resp?.notification?.request?.content?.data || {};
    onTap?.(data, resp);
  });
  return () => sub.remove();
}

/* =============================================================================
   ✅ NEW: Backend registration (GraphQL)
============================================================================= */

// ✅ ADD: Mutation matches your backend module
const REGISTER_EXPO_PUSH_TOKEN = gql`
  mutation RegisterExpoPushToken(
    $expoPushToken: String!
    $platform: String
    $deviceName: String
    $appVersion: String
  ) {
    registerExpoPushToken(
      expoPushToken: $expoPushToken
      platform: $platform
      deviceName: $deviceName
      appVersion: $appVersion
    )
  }
`;

/**
 * Register this device's Expo push token with your backend.
 * - Requires user to be logged in (Apollo authLink must attach JWT)
 * - Safe to call on app open; if not authed, it will just log an error.
 */
export async function bootRegisterPushTokenAsync(apolloClient) {
  try {
    if (!apolloClient) {
      console.log("[push] bootRegisterPushToken skipped: no apolloClient");
      return { ok: false, error: "no_apollo_client" };
    }

    await hydratePrefsOnce();

    if (!_prefs.enabled) {
      console.log("[push] bootRegisterPushToken skipped: disabled_in_app");
      return { ok: false, error: "disabled_in_app" };
    }

    // Make sure we have permission (won't always prompt, but will ensure status)
    const perm = await ensurePushPermissionsAsync();

    if (!perm?.granted) {
      console.log(
        "[push] bootRegisterPushToken skipped: permission_not_granted",
      );
      return { ok: false, error: "permission_not_granted" };
    }

    // Token is device-only
    const token = await getExpoPushTokenAsync();
    if (!token) {
      console.log("[push] bootPush error", "Could not obtain Expo push token");
      return { ok: false, error: "no_token" };
    }

    const appVersion = getAppVersionSafe();
    const deviceName = Device?.deviceName || Device?.modelName || "unknown";
    const platform = Platform.OS;

    console.log("[push] registering token with backend:", {
      tokenPreview: `${String(token).slice(0, 18)}…`,
      platform,
      deviceName,
      appVersion,
    });

    const res = await apolloClient.mutate({
      mutation: REGISTER_EXPO_PUSH_TOKEN,
      variables: {
        expoPushToken: token,
        platform,
        deviceName,
        appVersion,
      },
      fetchPolicy: "no-cache",
    });

    // Gateway returns Boolean! (see DEC-0004)
    if (res?.data?.registerExpoPushToken !== true) {
      console.log("[push] registerExpoPushToken failed: backend returned false");
      return { ok: false, error: "register_failed" };
    }

    console.log("[push] registerExpoPushToken ok");
    return { ok: true, error: null };
  } catch (e) {
    // Most common reason here: not authenticated yet.
    console.log("[push] bootRegisterPushToken exception", e?.message || e);
    return { ok: false, error: e?.message || "boot_error" };
  }
}

/**
 * Convenience: call this on app open.
 * - prompts (once per version)
 * - registers token (if possible)
 */
export async function bootPushAsync(apolloClient) {
  const prompt = await maybeAutoPromptPushPermissionsOnOpenAsync();
  const reg = await bootRegisterPushTokenAsync(apolloClient);
  return { prompt, reg };
}
