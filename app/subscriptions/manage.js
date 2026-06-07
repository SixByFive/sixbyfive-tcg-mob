// app/subscriptions/manage.js
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
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
import { COLORS } from "../../theme/colors";
import {
  MySubscriptionDocument,
  SubscriptionPortalDocument,
  CancelSubscriptionDocument,
  ResumeSubscriptionDocument,
} from "../../graphql/documents";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatusPill({ status, isCancelling }) {
  const label = isCancelling
    ? "Cancels at period end"
    : status === "active"
    ? "Active"
    : status === "trialing"
    ? "Trial"
    : status === "past_due"
    ? "Past due"
    : status ?? "—";

  const color =
    isCancelling
      ? "#f59e0b"
      : status === "active" || status === "trialing"
      ? "#10b981"
      : status === "past_due"
      ? "#ef4444"
      : COLORS.textMuted;

  return (
    <View style={[styles.pill, { borderColor: color + "44", backgroundColor: color + "15" }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export default function ManageSubscription() {
  const { planName } = useLocalSearchParams();
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  const { data: subData, loading: subLoading, refetch } = useQuery(
    MySubscriptionDocument,
    { fetchPolicy: "cache-and-network" }
  );
  const { data: portalData } = useQuery(SubscriptionPortalDocument, {
    fetchPolicy: "network-only",
  });

  const [cancelSubscription] = useMutation(CancelSubscriptionDocument, {
    refetchQueries: [{ query: MySubscriptionDocument }],
  });
  const [resumeSubscription] = useMutation(ResumeSubscriptionDocument, {
    refetchQueries: [{ query: MySubscriptionDocument }],
  });

  const sub = subData?.mySubscription;
  const portalUrl = portalData?.subscriptionPortal?.url;

  const displayName = sub?.plan?.name ?? planName ?? "Free";
  const periodEnd = formatDate(sub?.currentPeriodEnd);
  const periodStart = formatDate(sub?.currentPeriodStart);
  const isCancelling = !!sub?.cancelAtPeriodEnd;
  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const price = sub?.plan?.price
    ? `£${Number(sub.plan.price).toFixed(2)}/${sub.plan.interval === "year" ? "yr" : "mo"}`
    : null;

  const handlePortal = async () => {
    if (!portalUrl) return;
    setActionLoading("portal");
    try {
      await Linking.openURL(portalUrl);
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel subscription?",
      `Your ${displayName} plan will stay active until ${periodEnd}, then revert to Free.`,
      [
        { text: "Keep plan", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            setError(null);
            setActionLoading("cancel");
            try {
              await cancelSubscription();
              await refetch();
            } catch (e) {
              setError(e.message || "Failed to cancel subscription.");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleResume = async () => {
    setError(null);
    setActionLoading("resume");
    try {
      await resumeSubscription();
      await refetch();
    } catch (e) {
      setError(e.message || "Failed to resume subscription.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple
        title="Manage subscription"
        subtitle="Billing and plan details"
      />

      {subLoading && !sub ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* ── Plan card ───────────────────────────────────────────── */}
          <View style={styles.planCard}>
            <View style={styles.planCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{displayName}</Text>
                {price && <Text style={styles.planPrice}>{price}</Text>}
              </View>
              <StatusPill status={sub?.status} isCancelling={isCancelling} />
            </View>

            <View style={styles.planDetails}>
              {sub ? (
                <>
                  <DetailRow
                    label={isCancelling ? "Access until" : "Next renewal"}
                    value={periodEnd}
                  />
                  {periodStart && (
                    <DetailRow label="Member since" value={periodStart} />
                  )}
                  {sub.plan?.platformFeePercent != null && (
                    <DetailRow
                      label="Marketplace fee"
                      value={`${sub.plan.platformFeePercent}%`}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.freeNote}>
                  You're on the Free plan. Upgrade to unlock marketplace
                  access, price alerts, and more.
                </Text>
              )}
            </View>

            {isCancelling && (
              <View style={styles.cancellingBanner}>
                <Text style={styles.cancellingText}>
                  ⚠️ Your subscription is set to cancel on {periodEnd}. Tap
                  "Reactivate" below to keep your plan.
                </Text>
              </View>
            )}
          </View>

          {/* ── Error ───────────────────────────────────────────────── */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ── Actions ─────────────────────────────────────────────── */}
          <View style={styles.actions}>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push("/subscriptions")}
            >
              <Text style={styles.primaryText}>
                {sub ? "Change plan" : "View plans"}
              </Text>
            </Pressable>

            {portalUrl && (
              <Pressable
                style={styles.secondaryBtn}
                onPress={handlePortal}
                disabled={actionLoading === "portal"}
              >
                {actionLoading === "portal" ? (
                  <ActivityIndicator color={COLORS.text} size="small" />
                ) : (
                  <Text style={styles.secondaryText}>Open billing portal ↗</Text>
                )}
              </Pressable>
            )}

            {sub && isActive && !isCancelling && (
              <Pressable
                style={[styles.secondaryBtn, styles.dangerBtn]}
                onPress={handleCancel}
                disabled={actionLoading === "cancel"}
              >
                {actionLoading === "cancel" ? (
                  <ActivityIndicator color="#ef4444" size="small" />
                ) : (
                  <Text style={styles.dangerText}>Cancel subscription</Text>
                )}
              </Pressable>
            )}

            {sub && isCancelling && (
              <Pressable
                style={styles.secondaryBtn}
                onPress={handleResume}
                disabled={actionLoading === "resume"}
              >
                {actionLoading === "resume" ? (
                  <ActivityIndicator color={COLORS.text} size="small" />
                ) : (
                  <Text style={styles.secondaryText}>
                    ✓ Reactivate subscription
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          <Text style={styles.smallPrint}>
            Billing is handled by Stripe. Use the billing portal to update
            payment methods, download invoices, or manage VAT details.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 16, gap: 14, paddingBottom: 40 },

  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  planCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  planName: { color: COLORS.text, fontWeight: "900", fontSize: 20 },
  planPrice: { color: COLORS.accent, fontWeight: "800", fontSize: 15, marginTop: 2 },

  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  pillText: { fontWeight: "800", fontSize: 12 },

  planDetails: { padding: 16, gap: 10 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: { color: COLORS.textMuted, fontSize: 14 },
  detailValue: { color: COLORS.text, fontWeight: "700", fontSize: 14 },

  freeNote: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },

  cancellingBanner: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    borderRadius: 10,
    padding: 12,
  },
  cancellingText: { color: "#f59e0b", fontSize: 13, lineHeight: 18 },

  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    borderColor: "#ef444455",
    backgroundColor: "#ef444411",
  },
  errorText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  actions: { gap: 10 },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryText: { color: COLORS.text, fontWeight: "800" },

  dangerBtn: { borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.05)" },
  dangerText: { color: "#ef4444", fontWeight: "800" },

  smallPrint: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
