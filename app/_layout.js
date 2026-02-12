// app/_layout.js
//
// UPDATED (2026-02-09)
// - ADD: MessagingProvider wrapper so the mobile app can:
//   - listen for socket events (newMessage, typing)
//   - react to safety states (CHAT_AGREEMENT_REQUIRED / CHAT_BANNED / CHAT_BLOCKED)
//   - provide messaging actions across screens
//
// NOTE on imports:
// - If your apollo client lives at "app/lib/apollo.js" then import should be "./lib/apollo".
// - Your current code uses "../lib/apollo" which only works if "/lib/apollo.js" is one directory ABOVE /app.
//   Keep whichever matches your real folder structure.

import "react-native-gesture-handler";
import "react-native-reanimated";

import { ApolloProvider } from "@apollo/client";
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
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ToastProvider } from "../components/ui/ToastProvider";

import { client } from "../lib/apollo";

import { MessagingProvider } from "./contexts/MessengerContext";

const COLORS = {
  background: "#16171c",
  accent: "#2963FF",
};

import { useEffect } from "react";
import { connectSocket, getSocketId, isSocketConnected } from "../lib/realtime";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Raleway_700Bold,
    Raleway_800ExtraBold,
  });

  useEffect(() => {
    (async () => {
      const s = await connectSocket();
      console.log("[TEST] socket connected?", isSocketConnected());
      console.log("[TEST] socket id:", getSocketId());
    })();
  }, []);

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
