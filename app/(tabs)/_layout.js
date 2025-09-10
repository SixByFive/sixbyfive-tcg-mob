// app/(tabs)/_layout.js (or wherever this component lives)
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { FEATURES } from "../../lib/features";

export default function TabsLayout() {
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
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: "Collection",
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
        }}
      />

      {/* EXCHANGE: your route folder is likely "(tabs)/market", but the feature is "exchange" */}
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
        // Hidden fallback ensures Expo Router does not auto-add the tab button
        <Tabs.Screen name="market" options={{ href: null }} />
      )}

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />

      {/* MESSAGES */}
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
