// app/home.js
import { gql, useQuery } from "@apollo/client";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { clearToken } from "../lib/auth";

const ME = gql`
  query Me {
    me {
      id
      username
      email
      avatar
    }
  }
`;

export default function Home() {
  const { data, loading, error, refetch } = useQuery(ME, {
    fetchPolicy: "cache-and-network",
  });

  const user = data?.me;

  // If token is invalid/expired, bounce to /auth
  if (error?.message?.toLowerCase()?.includes("unauth")) {
    // optional: clear token
    // await clearToken();
    router.replace("/auth");
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#16171c", gap: 16, padding: 16 }}>
      {loading && (
        <>
          <ActivityIndicator size="large" color="#2963FF" />
          <Text style={{ color: "#b9bedd" }}>Loading your profile…</Text>
        </>
      )}

      {!loading && user && (
        <>
          <Text style={{ color: "#f7f8fa", fontSize: 22, fontWeight: "800" }}>
            Hey {user.username} 👋
          </Text>
          <Text style={{ color: "#b9bedd" }}>{user.email}</Text>

          <Pressable
            onPress={() => refetch()}
            style={{ backgroundColor: "#2963FF", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Refresh</Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              await clearToken();
              router.replace("/auth");
            }}
            style={{ backgroundColor: "#23243c", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 }}
          >
            <Text style={{ color: "#f7f8fa", fontWeight: "800" }}>Log out</Text>
          </Pressable>
        </>
      )}

      {!loading && !user && !error && (
        <Text style={{ color: "#f7f8fa" }}>No user found.</Text>
      )}

      {error && !loading && (
        <Text style={{ color: "#ff6b6b", textAlign: "center", paddingHorizontal: 12 }}>
          {error.message}
        </Text>
      )}
    </View>
  );
}
