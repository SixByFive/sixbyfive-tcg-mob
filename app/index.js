// app/index.js
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { getToken } from "../lib/auth";

export default function Index() {
  useEffect(() => {
    (async () => {
      const token = await getToken();
      router.replace(token ? "(tabs)/home" : "/auth");
    })();
  }, []);
  return (
    <View style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"#16171c" }}>
      <ActivityIndicator size="large" color="#2963FF" />
    </View>
  );
}
