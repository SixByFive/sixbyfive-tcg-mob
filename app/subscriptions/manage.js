// app/subscriptions/manage.js

import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../theme/colors";

export default function ManageSubscription() {
  const { status = "Pro" } = useLocalSearchParams();

  const openBillingPortal = async () => {
    // TODO: get portal URL from backend (Stripe customer portal / your billing page)
    const portal = "https://tcg.sixbyfive.com/billing";
    Linking.openURL(portal).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="Manage subscription" subtitle={`Current plan: ${status}`} />

      <View style={styles.card}>
        <Text style={styles.title}>{status} plan</Text>
        <Text style={styles.body}>Renews on 28 Oct 2025</Text>
        <View style={{ height: 8 }} />
        <Text style={styles.muted}>Includes:</Text>
        <Text style={styles.body}>• Advanced filters • Trade center • Hourly price updates</Text>
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => router.push("/subscriptions")}>
        <Text style={styles.primaryText}>Change plan</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={openBillingPortal}>
        <Text style={styles.secondaryText}>Open billing portal</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryBtn, { marginTop: 10 }]}
        onPress={() => {
          // TODO: cancel via backend
        }}
      >
        <Text style={styles.secondaryText}>Cancel subscription</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  title: { color: COLORS.text, fontWeight: "900" },
  body: { color: COLORS.text },
  muted: { color: COLORS.textMuted, marginBottom: 6 },

  primaryBtn: {
    marginHorizontal: 16, marginTop: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: COLORS.text, fontWeight: "800" },
});
