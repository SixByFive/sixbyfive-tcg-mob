// app/subscriptions/index.js
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation } from "@apollo/client";

import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import FeatureRow from "../../components/subscriptions/FeatureRow";
import PlanCard from "../../components/subscriptions/PlanCard";
import { COLORS } from "../../theme/colors";
import {
  SubscriptionPlansDocument,
  MySubscriptionDocument,
  CreateSubscriptionDocument,
  UpdateSubscriptionDocument,
} from "../../graphql/documents";

const PLAN_CONTENT = {
  free: {
    cta: "Get started",
    features: [
      { key: "f1", label: "Collection tracking (unlimited cards)", included: true },
      { key: "f2", label: "Digital binders (up to 3)", included: true },
      { key: "f3", label: "Advanced card search", included: true },
      { key: "f4", label: "Wishlist", included: true },
      { key: "f5", label: "Price tracking", included: true },
      { key: "f6", label: "Trading & Marketplace", included: false },
      { key: "f7", label: "Price alerts", included: false },
    ],
  },
  collector: {
    cta: "Upgrade to Collector",
    features: [
      { key: "f1", label: "Everything in Free", included: true },
      { key: "f2", label: "Unlimited digital binders", included: true },
      { key: "f3", label: "Saved searches & filters", included: true },
      { key: "f4", label: "Daily price alerts", included: true },
      { key: "f5", label: "Marketplace access", included: true },
      { key: "f6", label: "5% marketplace fee (was 7%)", included: true },
      { key: "f7", label: "Priority support", included: true },
    ],
  },
  trader: {
    cta: "Upgrade to Trader",
    features: [
      { key: "f1", label: "Everything in Collector", included: true },
      { key: "f2", label: "Hourly price alerts", included: true },
      { key: "f3", label: "Historical value charts", included: true },
      { key: "f4", label: "4% marketplace fee (was 7%)", included: true },
      { key: "f5", label: "Custom binder themes", included: true },
    ],
  },
  vendor: {
    cta: "Upgrade to Vendor",
    features: [
      { key: "f1", label: "Seller profile & storefront", included: true },
      { key: "f2", label: "Unlimited listings & trades", included: true },
      { key: "f3", label: "Order management tools", included: true },
      { key: "f4", label: "2% marketplace fee (was 7%)", included: true },
      { key: "f5", label: "Priority support", included: true },
    ],
  },
};

export default function Subscriptions() {
  const [selected, setSelected] = useState(null);
  const [interval, setInterval] = useState("month");

  const { data: plansData, loading: plansLoading } = useQuery(SubscriptionPlansDocument, {
    fetchPolicy: "cache-and-network",
  });
  const { data: subData, loading: subLoading } = useQuery(MySubscriptionDocument, {
    fetchPolicy: "cache-and-network",
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [createSubscription] = useMutation(CreateSubscriptionDocument);
  const [updateSubscription] = useMutation(UpdateSubscriptionDocument, {
    refetchQueries: [{ query: MySubscriptionDocument }],
  });

  const allPlans = plansData?.subscriptionPlans ?? [];

  // Separate free plan (price 0, no interval) from paid plans
  const freePlans = useMemo(
    () => allPlans.filter((p) => !p.price || Number(p.price) === 0),
    [allPlans]
  );
  const paidPlans = useMemo(
    () => allPlans.filter((p) => Number(p.price) > 0 && p.interval === interval),
    [allPlans, interval]
  );

  const displayPlans = useMemo(() => {
    const combined = [...freePlans, ...paidPlans].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    return combined.map((plan) => {
      const key = (plan.name || "").toLowerCase();
      const content = PLAN_CONTENT[key] ?? {};
      const numPrice = Number(plan.price);
      let price;
      if (!plan.price || numPrice === 0) {
        price = "Free";
      } else if (plan.interval === "year") {
        price = `£${numPrice.toFixed(2)}/yr  (£${(numPrice / 12).toFixed(2)}/mo)`;
      } else {
        price = `£${numPrice.toFixed(2)}/mo`;
      }
      const features = (plan.featuresJson || []).length > 0
        ? plan.featuresJson.map((f, i) => ({ key: String(i), label: f, included: true }))
        : content.features ?? [];
      return {
        id: plan.id,
        name: plan.name,
        price,
        interval: plan.interval,
        cta: content.cta ?? "Get started",
        features,
        hasStripe: Boolean(plan.stripePriceIdMonthly || plan.stripePriceIdYearly),
        highlighted: key === "collector",
      };
    });
  }, [freePlans, paidPlans]);

  const currentSub = subData?.mySubscription;
  const currentPlanId = currentSub?.plan?.id;

  // Yearly saving vs monthly (rough % saving)
  const yearlySaving = useMemo(() => {
    const monthly = allPlans.filter((p) => Number(p.price) > 0 && p.interval === "month");
    const yearly = allPlans.filter((p) => Number(p.price) > 0 && p.interval === "year");
    if (!monthly.length || !yearly.length) return null;
    const mTotal = monthly.reduce((s, p) => s + Number(p.price), 0);
    const yMonthly = yearly.reduce((s, p) => s + Number(p.price) / 12, 0);
    if (!mTotal) return null;
    return Math.round(((mTotal - yMonthly) / mTotal) * 100);
  }, [allPlans]);

  React.useEffect(() => {
    if (displayPlans.length && !selected) {
      const collector = displayPlans.find((p) => p.name?.toLowerCase() === "collector");
      setSelected((collector ?? displayPlans[0]).id);
    }
  }, [displayPlans, selected]);

  // Reset selection when interval changes
  React.useEffect(() => {
    setSelected(null);
  }, [interval]);

  const selectedPlan = displayPlans.find((p) => p.id === selected);

  const handleSubscribe = async (planId) => {
    const plan = displayPlans.find((p) => p.id === planId);
    if (!plan) return;
    setCheckoutError(null);

    // Already on this plan — go to manage
    if (planId === currentPlanId) {
      router.push({ pathname: "/subscriptions/manage", params: { planName: plan.name } });
      return;
    }

    // No Stripe price — just show manage page
    if (!plan.hasStripe) {
      router.push("/subscriptions/manage");
      return;
    }

    const isFree = !plan.price || plan.price === "Free";
    const hasActivePaidSub =
      currentSub &&
      (currentSub.status === "active" || currentSub.status === "trialing") &&
      !currentSub.cancelAtPeriodEnd &&
      currentSub.plan?.price &&
      Number(currentSub.plan.price) > 0;

    // Existing paid subscriber switching plans → updateSubscription (prorated, no redirect)
    if (hasActivePaidSub && !isFree) {
      Alert.alert(
        `Switch to ${plan.name}?`,
        `Your plan will change immediately with prorated billing. You'll be charged the difference or credited accordingly.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              setCheckoutLoading(true);
              try {
                await updateSubscription({ variables: { planId } });
                router.push({
                  pathname: "/subscriptions/manage",
                  params: { planName: plan.name },
                });
              } catch (e) {
                setCheckoutError(e.message || "Failed to switch plan.");
              } finally {
                setCheckoutLoading(false);
              }
            },
          },
        ]
      );
      return;
    }

    // New subscriber or downgrading to free → Stripe Checkout
    setCheckoutLoading(true);
    try {
      const { data } = await createSubscription({ variables: { planId } });
      const url = data?.createSubscription?.url;
      if (url) await Linking.openURL(url);
    } catch (e) {
      setCheckoutError(e.message || "Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const loading = plansLoading || subLoading;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="Subscriptions" subtitle="Pick the plan that fits" />

      {loading && !displayPlans.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* Monthly / yearly toggle */}
          <View style={styles.toggleWrap}>
            <Pressable
              onPress={() => setInterval("month")}
              style={[styles.toggleBtn, interval === "month" && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, interval === "month" && styles.toggleTextActive]}>
                Monthly
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInterval("year")}
              style={[styles.toggleBtn, interval === "year" && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, interval === "year" && styles.toggleTextActive]}>
                Yearly
              </Text>
              {yearlySaving && (
                <View style={styles.savingPip}>
                  <Text style={styles.savingPipText}>Save ~{yearlySaving}%</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Plan cards */}
          <View style={{ gap: 10, marginTop: 16 }}>
            {displayPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selected === plan.id}
                isCurrent={plan.id === currentPlanId}
                onPress={() => setSelected(plan.id)}
              />
            ))}
          </View>

          {/* Feature list for selected plan */}
          {selectedPlan && (
            <View style={styles.featureCard}>
              <Text style={styles.featureTitle}>
                What&apos;s included with {selectedPlan.name}
              </Text>
              <View style={{ gap: 10, marginTop: 10 }}>
                {selectedPlan.features.map((f) => (
                  <FeatureRow key={f.key} label={f.label} included={f.included} />
                ))}
              </View>
            </View>
          )}

          {/* Renewal copy */}
          {selectedPlan && selectedPlan.price !== "Free" && (
            <Text style={styles.small}>
              Renews at {selectedPlan.price}. Cancel anytime via the billing portal.
            </Text>
          )}

          {/* Checkout error */}
          {checkoutError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{checkoutError}</Text>
            </View>
          ) : null}

          {/* Primary CTA */}
          {selectedPlan && (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed || checkoutLoading ? 0.8 : 1 },
              ]}
              onPress={() => handleSubscribe(selectedPlan.id)}
              disabled={!!checkoutLoading}
            >
              <Text style={styles.primaryText}>
                {checkoutLoading
                  ? "Please wait…"
                  : selectedPlan.id === currentPlanId
                  ? "Manage plan"
                  : selectedPlan.cta}
              </Text>
            </Pressable>
          )}

          {/* Manage current */}
          {currentSub && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/subscriptions/manage",
                  params: { planName: currentSub.plan?.name ?? "your plan" },
                })
              }
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryText}>Manage current subscription</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  errorBox: {
    marginHorizontal: 0,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    borderColor: "#ef444455",
    backgroundColor: "#ef444411",
  },
  errorText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  toggleWrap: {
    flexDirection: "row",
    backgroundColor: COLORS.alt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  toggleText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 14 },
  toggleTextActive: { color: COLORS.text, fontWeight: "900" },
  savingPip: {
    backgroundColor: "#16a34a",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingPipText: { color: "#fff", fontSize: 10, fontWeight: "900" },

  featureCard: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  featureTitle: { color: COLORS.text, fontWeight: "900" },

  small: {
    color: COLORS.textMuted,
    marginTop: 12,
    marginBottom: 4,
    fontSize: 12,
    textAlign: "center",
  },
  primaryBtn: {
    marginTop: 16,
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
