// app/subscriptions/index.js

import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import FeatureRow from "../../components/subscriptions/FeatureRow";
import PlanCard from "../../components/subscriptions/PlanCard";
import { COLORS } from "../../theme/colors";
// (Optional) inline confirmation sheet
// import PaywallSheet from "../../components/subscriptions/PaywallSheet";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    period: "",
    cta: "Get started",
    highlighted: false,
    features: [
      { key: "f1", label: "Basic binder management", included: true },
      { key: "f2", label: "Wishlist", included: true },
      { key: "f3", label: "Price snapshots (daily)", included: false },
      { key: "f4", label: "Advanced filters", included: false },
      { key: "f5", label: "Trade center", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "£3.99",
    period: "/mo",
    cta: "Start 7-day trial",
    highlighted: true, // badge and accent border
    features: [
      { key: "f1", label: "Everything in Free", included: true },
      { key: "f3", label: "Price snapshots (hourly)", included: true },
      { key: "f4", label: "Advanced filters & binders", included: true },
      { key: "f5", label: "Trade center", included: true },
      { key: "f6", label: "Priority support", included: true },
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "£39.99",
    period: "/yr",
    cta: "Go Elite",
    highlighted: false,
    features: [
      { key: "f1", label: "Everything in Pro", included: true },
      { key: "f7", label: "Early access to drops", included: true },
      { key: "f8", label: "Exclusive badge", included: true },
    ],
  },
];

export default function Subscriptions() {
  const [selected, setSelected] = useState("pro"); // default highlight
  const selectedPlan = useMemo(() => PLANS.find(p => p.id === selected), [selected]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="Subscriptions" subtitle="Pick the plan that fits" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Plans */}
        <View style={{ gap: 12 }}>
          {PLANS.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={selected === plan.id}
              onPress={() => setSelected(plan.id)}
            />
          ))}
        </View>

        {/* Feature matrix (from selected plan) */}
        <View style={styles.card}>
          <Text style={styles.title}>What you get</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {selectedPlan.features.map(f => (
              <FeatureRow key={f.key} label={f.label} included={f.included} />
            ))}
          </View>
        </View>

        {/* Legal copy */}
        <Text style={styles.small}>
          Trial renews to {selectedPlan?.name} at {selectedPlan?.price}{selectedPlan?.period}. Cancel anytime.
        </Text>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => {
            // TODO: invoke purchase flow (RevenueCat/Stripe/native store)
            router.push({ pathname: "/subscriptions/manage", params: { status: selectedPlan?.name || "Pro" } });
          }}
        >
          <Text style={styles.primaryText}>
            {selectedPlan?.cta || "Continue"}
          </Text>
        </Pressable>

        {/* Secondary: restore purchases */}
        <Pressable
          onPress={() => {
            // TODO: restore purchases (store/RevenueCat)
          }}
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryText}>Restore purchases</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  title: { color: COLORS.text, fontWeight: "900" },
  small: { color: COLORS.textMuted, marginTop: 12, marginBottom: 10, fontSize: 12 },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900", letterSpacing: 0.2 },

  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginTop: 10,
  },
  secondaryText: { color: COLORS.text, fontWeight: "800" },
});
