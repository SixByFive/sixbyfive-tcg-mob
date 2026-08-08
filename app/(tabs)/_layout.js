// app/(tabs)/_layout.js
import { Ionicons } from "@expo/vector-icons";
import { useMeQuery } from "../../hooks/useMeQuery";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { clearToken } from "../../lib/auth";
import { FEATURES } from "../../lib/features";
import { COLORS } from "../../theme/colors";

export default function TabsLayout() {
  const router = useRouter();
  const { data, loading, error } = useMeQuery({ fetchPolicy: "cache-first" });
  const autoLoggedOutRef = useRef(false);

  useEffect(() => {
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
  }, [data, error, loading, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
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

      {FEATURES.exchange ? (
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

      {FEATURES.messages ? (
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
