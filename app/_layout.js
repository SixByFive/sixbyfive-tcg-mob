// app/_layout.js

// (Optional but safe in Expo) ensure gesture handler initializes ASAP
import "react-native-gesture-handler";
// (Optional) you already have the babel plugin below; this import is harmless
import "react-native-reanimated";

import { ApolloProvider } from "@apollo/client";
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Raleway_700Bold, Raleway_800ExtraBold } from "@expo-google-fonts/raleway";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler"; // ✅ ADDED
import { client } from "../lib/apollo";

const COLORS = {
  background: "#16171c",
  accent: "#2963FF",
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Raleway_700Bold,
    Raleway_800ExtraBold,
  });

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
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
          }}
        />
      </GestureHandlerRootView>
    </ApolloProvider>
  );
}
