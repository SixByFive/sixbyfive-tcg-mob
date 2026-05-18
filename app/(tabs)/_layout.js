// app/(tabs)/_layout.js
import { Ionicons } from "@expo/vector-icons";
import { useMeQuery } from "../../hooks/useMeQuery";
import Constants from "expo-constants";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { clearToken } from "../../lib/auth";
import { FEATURES } from "../../lib/features";

export default function TabsLayout() {
  const router = useRouter();
  const { data, loading, error } = useMeQuery({ fetchPolicy: "cache-first" });
  const autoLoggedOutRef = useRef(false);

  const extra = Constants.expoConfig?.extra || {};
  const DEV_MODE = !!extra.EXPO_PUBLIC_DEV_MODE;

  const showMessages = useMemo(() => {
    if (DEV_MODE) return true;
    return !!FEATURES.messages;
  }, [DEV_MODE]);

  const showExchange = useMemo(() => {
    if (DEV_MODE) return !!FEATURES.exchange; // keep exchange true/false even in dev
    return !!FEATURES.exchange;
  }, [DEV_MODE]);

  useEffect(() => {
    // Helpful one-liner to diagnose missing tab
    console.log("[tabs] flags", {
      DEV_MODE,
      FEATURES_messages: FEATURES.messages,
      showMessages,
      hasUser: !!data?.me,
      loading,
      hasError: !!error,
    });

    if (autoLoggedOutRef.current) return;
    if (loading) return;

    const user = data?.me;
    if (user) return;

    const graphQlErrors = Array.isArray(error?.graphQLErrors)
      ? error.graphQLErrors
      : [];
    const hasAuthGraphQLError = graphQlErrors.some((err) => {
      const code = String(err?.extensions?.code || "").toUpperCase();
      return code === "UNAUTHENTICATED" || code === "FORBIDDEN";
    });

    const networkError = error?.networkError;
    const statusCode =
      networkError && typeof networkError === "object"
        ? (networkError.statusCode ??
          networkError.status ??
          networkError.response?.status)
        : null;
    const hasAuthNetworkError = statusCode === 401 || statusCode === 403;

    const completedWithoutUser = !error && data && !user;

    if (!hasAuthGraphQLError && !hasAuthNetworkError && !completedWithoutUser) {
      return;
    }

    autoLoggedOutRef.current = true;

    (async () => {
      try {
        await clearToken();
      } catch (e) {
        console.warn("Failed to clear auth token after auth error", e);
      }
      router.replace("/auth");
    })();
  }, [data, error, loading, router, DEV_MODE, showMessages]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#191a20", borderTopColor: "#31365e" },
        tabBarActiveTintColor: "#2963FF",
        tabBarInactiveTintColor: "#8f98bc",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="collection"
        options={{
          title: "Collection",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums" color={color} size={size} />
          ),
        }}
      />

      {showExchange ? (
        <Tabs.Screen
          name="market"
          options={{
            title: "Exchange",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="swap-horizontal" color={color} size={size} />
            ),
          }}
        />
      ) : (
        <Tabs.Screen name="market" options={{ href: null }} />
      )}

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />

      {showMessages ? (
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses" color={color} size={size} />
            ),
          }}
        />
      ) : (
        <Tabs.Screen name="messages" options={{ href: null }} />
      )}
    </Tabs>
  );
}
