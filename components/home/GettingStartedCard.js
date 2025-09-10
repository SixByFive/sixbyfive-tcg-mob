// components/home/GettingStartedCard.js
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

function Step({ title, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.step, pressed && { opacity: 0.9 }]}>
      <View style={styles.bullet} />
      <Text style={styles.stepText}>{title}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

export default function GettingStartedCard() {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Getting started</Text>
      <Text style={styles.sub}>A few quick actions to set things up.</Text>

      <View style={styles.list}>
        <Step title="Create your first binder" onPress={() => router.push("/binder/new")} />
        <Step title="Search cards" onPress={() => router.push("/(tabs)/search")} />
        <Step title="Browse sets and explore" onPress={() => router.push("/sets")} />
        <Step title="Complete your profile" onPress={() => router.push("/(tabs)/profile")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  title: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  sub: { color: COLORS.textMuted, marginTop: 4, marginBottom: 8 },
  list: { marginTop: 6 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginRight: 10,
  },
  stepText: { color: COLORS.text, flex: 1 },
  chev: { color: COLORS.textMuted, fontSize: 18, marginLeft: 8 },
});
