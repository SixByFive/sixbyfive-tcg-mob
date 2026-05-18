// app/_layout.js
//
// UPDATED (2026-02-17)
//
// CHANGES:
// - FIX: Import maybeAutoPromptPushPermissionsOnOpenAsync (was used but not imported)
// - ADD: Import getExpoPushTokenAsync to fetch token after prompt
// - ADD: Register Expo token with backend via registerExpoPushToken mutation
// - ADD: Best-effort device/app metadata (platform/deviceName/appVersion)
// - KEEP: Global notification tap handler -> routes to /messages/[userId]
// - KEEP: Prevent duplicate socket connect in React 18 dev

import "react-native-gesture-handler";
import "react-native-reanimated";

import { ApolloProvider, gql } from "@apollo/client";
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Raleway_700Bold,
  Raleway_800ExtraBold,
} from "@expo-google-fonts/raleway";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ToastProvider } from "../components/ui/ToastProvider";

import { client } from "../lib/apollo";
import { MessagingProvider } from "./contexts/MessengerContext";

import { connectSocket, getSocketId, isSocketConnected } from "../lib/realtime";

// ✅ CHANGED: include the auto-prompt + token helper
import {
  addNotificationTapListener,
  getExpoPushTokenAsync,
  maybeAutoPromptPushPermissionsOnOpenAsync,
} from "../lib/push";

/* =============================================================================
   GraphQL: register token (kept inline to avoid extra file if you prefer)
   You can move this into app/graphql/push.js later if you want.
============================================================================= */
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

const COLORS = {
  background: "#16171c",
  accent: "#2963FF",
};

function getAppVersionSafe() {
  return (
    Constants?.expoConfig?.version ||
    Constants?.manifest?.version || // older expo
    "0.0.0"
  );
}

function getDeviceNameSafe() {
  // Device.modelName is sync and safe; deviceName can be async/undefined depending on platform.
  return Device?.modelName || Device?.deviceName || `${Platform.OS}`;
}

async function bootPushAndRegisterToken() {
  try {
    // 1) Prompt on open (once per app version) if in-app prefs.enabled === true
    const promptRes = await maybeAutoPromptPushPermissionsOnOpenAsync();
    if (__DEV__) console.log("[push] auto-prompt:", promptRes);

    // 2) Try fetch Expo token (WILL FAIL in Expo Go SDK 53+; works in dev builds)
    const token = await getExpoPushTokenAsync();
    if (!token) {
      if (__DEV__)
        console.log(
          "[push] No Expo token (Expo Go / not supported / not granted)",
        );
      return;
    }

    // 3) Register token with backend
    const variables = {
      expoPushToken: token,
      platform: Platform.OS,
      deviceName: getDeviceNameSafe(),
      appVersion: getAppVersionSafe(),
    };

    const { data } = await client.mutate({
      mutation: REGISTER_EXPO_PUSH_TOKEN,
      variables,
      fetchPolicy: "no-cache",
    });

    const ok = data?.registerExpoPushToken;
    if (!ok) {
      console.log("[push] registerExpoPushToken failed");
    } else {
      if (__DEV__)
        console.log("[push] token registered ✅", token.slice(0, 10) + "…");
    }
  } catch (e) {
    console.log("[push] bootPush error", e?.message || e);
  }
}

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Raleway_700Bold,
    Raleway_800ExtraBold,
  });

  // React 18 dev can double-run effects; prevent double init
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      await bootPushAndRegisterToken();

      // Existing socket boot
      await connectSocket();
      console.log("[TEST] socket connected?", isSocketConnected());
      console.log("[TEST] socket id:", getSocketId());
    })();
  }, []);

  useEffect(() => {
    // Global push notification tap -> route to DM thread
    // Expected payload:
    // data: { type: "dm", userId: "..." }
    const unsubscribe = addNotificationTapListener((data) => {
      const userId = data?.userId ? String(data.userId) : "";
      if (!userId) return;

      router.push(`/messages/${encodeURIComponent(userId)}`);
    });

    return unsubscribe;
  }, [router]);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ApolloProvider client={client}>
      <StatusBar style="light" />
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: COLORS.background }}
      >
        <ToastProvider>
          <MessagingProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.background },
              }}
            />
          </MessagingProvider>
        </ToastProvider>
      </GestureHandlerRootView>
    </ApolloProvider>
  );
}
