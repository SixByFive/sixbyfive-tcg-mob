// components/market/SellerDashboardSheet.js
// Seller analytics dashboard — composites data from reputation, orders,
// wallet transactions, and listings. No new backend queries needed.

import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  SellerReviewsDocument,
  WalletDetailDocument,
  MyMarketListingsDocument,
  MyOrdersDocument,
  MySubscriptionDocument,
} from "../../graphql/documents";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  return mo === 1 ? "1mo ago" : `${mo}mo ago`;
}

function StarRow({ rating, size = 14 }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text
          key={i}
          style={{
            fontSize: size,
            color: i <= rating ? "#f59e0b" : COLORS.border,
          }}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

function StatBox({ label, value, sub, accent }) {
  return (
    <View style={styles.statBox}>
      <Text
        style={[styles.statValue, accent && { color: COLORS.accent }]}
      >
        {value}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function SellerDashboardSheet({ visible, onClose, myUserId }) {
  const insets = useSafeAreaInsets();

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: repData,
    loading: repLoading,
    refetch: refetchRep,
  } = useQuery(SellerReviewsDocument, {
    variables: { userId: myUserId, limit: 6 },
    fetchPolicy: "cache-and-network",
    skip: !visible || !myUserId,
  });

  const {
    data: walletData,
    loading: walletLoading,
    refetch: refetchWallet,
  } = useQuery(WalletDetailDocument, {
    variables: { limit: 200, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const {
    data: listingsData,
    loading: listingsLoading,
    refetch: refetchListings,
  } = useQuery(MyMarketListingsDocument, {
    variables: { limit: 200 },
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const {
    data: ordersData,
    loading: ordersLoading,
    refetch: refetchOrders,
  } = useQuery(MyOrdersDocument, {
    variables: { role: "seller", limit: 200 },
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const { data: subData } = useQuery(MySubscriptionDocument, {
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const loading =
    repLoading || walletLoading || listingsLoading || ordersLoading;

  function refetchAll() {
    refetchRep();
    refetchWallet();
    refetchListings();
    refetchOrders();
  }

  // ── Vendor tier check ──────────────────────────────────────────────────────
  // Any active/trialing paid plan unlocks analytics
  const subStatus = subData?.mySubscription?.status;
  const subPlan   = subData?.mySubscription?.plan?.name ?? "";
  const isVendor  =
    (subStatus === "active" || subStatus === "trialing") &&
    subPlan.toLowerCase() !== "free";

  // ── Derived stats ──────────────────────────────────────────────────────────

  const rep = repData?.sellerReputation ?? null;
  const reviews = repData?.sellerReviews ?? [];

  const walletTxs = walletData?.myWallet?.transactions ?? [];
  const walletBalance = walletData?.myWallet?.balance ?? 0;

  // Earnings from sale_credit wallet transactions
  const { totalEarnings, monthEarnings } = useMemo(() => {
    const saleTxs = walletTxs.filter((tx) => tx.type === "sale_credit");
    const cutoff = Date.now() - MONTH_MS;
    return {
      totalEarnings: saleTxs.reduce((s, tx) => s + (tx.amount ?? 0), 0),
      monthEarnings: saleTxs
        .filter((tx) => tx.createdAt && new Date(tx.createdAt).getTime() > cutoff)
        .reduce((s, tx) => s + (tx.amount ?? 0), 0),
    };
  }, [walletTxs]);

  // Listing counts
  const allListings = listingsData?.myListings ?? [];
  const activeListings = allListings.filter((l) => l.status === "ACTIVE").length;
  const totalListings = allListings.length;

  // Completed sales from orders
  const completedOrders = useMemo(() => {
    const orders = ordersData?.myOrders ?? [];
    return orders.filter((o) => o.fulfilmentStatus === "COMPLETED");
  }, [ordersData]);

  // Gross sales revenue from completed orders
  const grossRevenue = useMemo(
    () => completedOrders.reduce((s, o) => s + (o.salePrice ?? 0), 0),
    [completedOrders]
  );

  // Reputation score label
  const totalRatings = (rep?.positive ?? 0) + (rep?.negative ?? 0) + (rep?.neutral ?? 0);
  const ratingPct =
    totalRatings > 0
      ? Math.round(((rep?.positive ?? 0) / totalRatings) * 100)
      : null;

  // Star equivalent (out of 5, weighted)
  const avgStars = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((s, r) => s + (r.rating ?? 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  // ── Vendor-tier analytics ──────────────────────────────────────────────────

  // Monthly revenue — last 6 months from sale_credit wallet txs
  const monthlyRevenue = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        amount: 0,
      };
    });
    walletTxs
      .filter((tx) => tx.type === "sale_credit" && tx.createdAt)
      .forEach((tx) => {
        const d = new Date(tx.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = months.find((x) => x.key === key);
        if (m) m.amount += tx.amount ?? 0;
      });
    return months;
  }, [walletTxs]);

  const maxMonthly = useMemo(
    () => Math.max(...monthlyRevenue.map((m) => m.amount), 0.01),
    [monthlyRevenue]
  );

  // 30-day sales trend: completed orders this 30d vs previous 30d
  const { last30Sales, prev30Sales } = useMemo(() => {
    const now = Date.now();
    const day30 = 30 * 86400000;
    let last30Sales = 0, prev30Sales = 0;
    completedOrders.forEach((o) => {
      if (!o.completedAt) return;
      const age = now - new Date(o.completedAt).getTime();
      if (age < day30) last30Sales++;
      else if (age < day30 * 2) prev30Sales++;
    });
    return { last30Sales, prev30Sales };
  }, [completedOrders]);

  const salesTrendPct =
    prev30Sales === 0
      ? last30Sales > 0 ? 100 : null
      : Math.round(((last30Sales - prev30Sales) / prev30Sales) * 100);

  // Avg order value
  const avgOrderValue =
    completedOrders.length > 0 ? grossRevenue / completedOrders.length : 0;

  // Conversion rate: sold / (sold + active) listings
  const soldCount = allListings.filter((l) => l.status === "SOLD").length;
  const conversionRate =
    totalListings > 0 ? Math.round((soldCount / totalListings) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 48 }} />
          <Text style={styles.headerTitle}>Seller Dashboard</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.navText}>Done</Text>
          </Pressable>
        </View>

        {loading && !rep && !walletData ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.accent} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refetchAll}
                tintColor={COLORS.accent}
              />
            }
          >
            {/* ── Earnings card ─────────────────────────────────────── */}
            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Total earnings</Text>
              <Text style={styles.earningsAmount}>
                £{totalEarnings.toFixed(2)}
              </Text>
              <View style={styles.earningsRow}>
                <View>
                  <Text style={styles.earningsSubLabel}>This month</Text>
                  <Text style={styles.earningsSubValue}>
                    £{monthEarnings.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.earningsDivider} />
                <View>
                  <Text style={styles.earningsSubLabel}>Wallet balance</Text>
                  <Text style={styles.earningsSubValue}>
                    £{walletBalance.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.earningsDivider} />
                <View>
                  <Text style={styles.earningsSubLabel}>Gross sales</Text>
                  <Text style={styles.earningsSubValue}>
                    £{grossRevenue.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Stats row ─────────────────────────────────────────── */}
            <View style={styles.statsRow}>
              <StatBox
                label="Sales"
                value={rep?.completedMarketplace ?? completedOrders.length}
                sub="completed"
              />
              <StatBox
                label="Active"
                value={activeListings}
                sub={`of ${totalListings} listed`}
              />
              <StatBox
                label="Rating"
                value={avgStars ? `${avgStars}★` : ratingPct != null ? `${ratingPct}%` : "—"}
                sub={
                  totalRatings > 0
                    ? `${totalRatings} rating${totalRatings !== 1 ? "s" : ""}`
                    : "no ratings yet"
                }
                accent
              />
            </View>

            {/* ── Reputation breakdown ──────────────────────────────── */}
            {rep && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reputation</Text>

                {ratingPct != null && (
                  <View style={styles.repScoreRow}>
                    <Text style={styles.repPct}>{ratingPct}%</Text>
                    <Text style={styles.repPctLabel}>positive feedback</Text>
                    {ratingPct >= 95 && (
                      <View style={styles.trustedBadge}>
                        <Text style={styles.trustedBadgeText}>✓ Trusted</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.repBars}>
                  <RepBar
                    label="Positive"
                    count={rep.positive}
                    total={totalRatings}
                    color="#10b981"
                  />
                  <RepBar
                    label="Neutral"
                    count={rep.neutral}
                    total={totalRatings}
                    color={COLORS.textMuted}
                  />
                  <RepBar
                    label="Negative"
                    count={rep.negative}
                    total={totalRatings}
                    color="#ef4444"
                  />
                </View>

                {rep.flagged && (
                  <View style={styles.flaggedBanner}>
                    <Text style={styles.flaggedText}>
                      ⚠️ Your account has been flagged. Contact support for details.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Recent reviews ────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Reviews</Text>

              {reviews.length === 0 ? (
                <Text style={styles.emptyText}>No reviews yet.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {reviews.map((r, i) => (
                    <View key={i} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <StarRow rating={r.rating} />
                        <Text style={styles.reviewTime}>
                          {timeAgo(r.createdAt)}
                        </Text>
                      </View>
                      {r.review ? (
                        <Text style={styles.reviewText}>{r.review}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Listings breakdown ────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Listings</Text>
              <View style={styles.listingsRow}>
                {[
                  { label: "Active",    status: "ACTIVE",    color: "#10b981" },
                  { label: "Sold",      status: "SOLD",      color: COLORS.accent },
                  { label: "Pending",   status: "PENDING",   color: "#f59e0b" },
                  { label: "Suspended", status: "SUSPENDED", color: "#ef4444" },
                ].map(({ label, status, color }) => {
                  const count = allListings.filter(
                    (l) => l.status === status
                  ).length;
                  return (
                    <View key={status} style={styles.listingStatBox}>
                      <Text style={[styles.listingCount, { color }]}>
                        {count}
                      </Text>
                      <Text style={styles.listingLabel}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Vendor analytics ──────────────────────────────────── */}
            {isVendor ? (
              <>
                {/* Revenue chart */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Revenue — last 6 months</Text>
                  <View style={styles.barChart}>
                    {monthlyRevenue.map((m) => {
                      const pct = m.amount / maxMonthly;
                      const hasValue = m.amount > 0;
                      return (
                        <View key={m.key} style={styles.barCol}>
                          <Text style={styles.barValueLabel} numberOfLines={1}>
                            {hasValue ? `£${m.amount < 10 ? m.amount.toFixed(2) : Math.round(m.amount)}` : ""}
                          </Text>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  height: hasValue
                                    ? `${Math.max(pct * 100, 6)}%`
                                    : "0%",
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.barMonthLabel}>{m.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Performance insights */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Performance</Text>
                  <View style={styles.insightRow}>
                    <InsightCard
                      label="Avg order value"
                      value={`£${avgOrderValue.toFixed(2)}`}
                      sub={`${completedOrders.length} orders`}
                    />
                    <InsightCard
                      label="Sales (30d)"
                      value={String(last30Sales)}
                      trend={salesTrendPct}
                    />
                    <InsightCard
                      label="Conversion"
                      value={`${conversionRate}%`}
                      sub={`${soldCount} of ${totalListings}`}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.upsellCard}>
                <Text style={styles.upsellTitle}>Unlock analytics</Text>
                <Text style={styles.upsellBody}>
                  Upgrade to a paid plan to see your monthly revenue chart,
                  sales trend, average order value, and conversion rate.
                </Text>
                <Pressable
                  onPress={() => { onClose(); router.push("/subscriptions"); }}
                  style={styles.upsellBtn}
                >
                  <Text style={styles.upsellBtnText}>View plans</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── InsightCard ───────────────────────────────────────────────────────────────

function InsightCard({ label, value, sub, trend }) {
  const trendColor =
    trend == null
      ? COLORS.textMuted
      : trend > 0
      ? "#10b981"
      : trend < 0
      ? "#ef4444"
      : COLORS.textMuted;
  const trendLabel =
    trend == null ? null : trend > 0 ? `+${trend}%` : `${trend}%`;

  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightValue}>{value}</Text>
      {sub ? <Text style={styles.insightSub}>{sub}</Text> : null}
      {trendLabel != null ? (
        <Text style={[styles.insightSub, { color: trendColor, fontWeight: "700" }]}>
          {trendLabel} vs prev 30d
        </Text>
      ) : null}
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

// ── RepBar ────────────────────────────────────────────────────────────────────

function RepBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.repBarRow}>
      <Text style={styles.repBarLabel}>{label}</Text>
      <View style={styles.repBarTrack}>
        <View
          style={[
            styles.repBarFill,
            { width: `${pct}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.repBarCount}>{count}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  navText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: 15,
    minWidth: 48,
    textAlign: "right",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: 14, gap: 14 },

  // Earnings card
  earningsCard: {
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  earningsLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "700",
  },
  earningsAmount: { color: "#fff", fontSize: 36, fontWeight: "900" },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 16,
  },
  earningsSubLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "600",
  },
  earningsSubValue: { color: "#fff", fontWeight: "800", fontSize: 15, marginTop: 2 },
  earningsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 22,
  },
  statSub: { color: COLORS.textMuted, fontSize: 10 },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Section
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },

  // Reputation
  repScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  repPct: { color: COLORS.text, fontWeight: "900", fontSize: 24 },
  repPctLabel: { color: COLORS.textMuted, fontSize: 13, flex: 1 },
  trustedBadge: {
    backgroundColor: "#10b98120",
    borderWidth: 1,
    borderColor: "#10b98140",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trustedBadgeText: { color: "#10b981", fontWeight: "800", fontSize: 12 },
  repBars: { gap: 8 },
  repBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  repBarLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    width: 60,
  },
  repBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.alt,
    borderRadius: 3,
    overflow: "hidden",
  },
  repBarFill: {
    height: "100%",
    borderRadius: 3,
    minWidth: 3,
  },
  repBarCount: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 13,
    width: 28,
    textAlign: "right",
  },
  flaggedBanner: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 10,
    padding: 12,
  },
  flaggedText: { color: "#ef4444", fontSize: 13, fontWeight: "700" },

  // Reviews
  reviewCard: {
    backgroundColor: COLORS.alt,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 12,
    gap: 4,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewTime: { color: COLORS.textMuted, fontSize: 11 },
  reviewText: { color: COLORS.text, fontSize: 13, lineHeight: 18, marginTop: 2 },

  // Listings breakdown
  listingsRow: {
    flexDirection: "row",
    gap: 8,
  },
  listingStatBox: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.alt,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: 12,
    gap: 2,
  },
  listingCount: { fontWeight: "900", fontSize: 20 },
  listingLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700" },

  // Revenue bar chart
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: 6,
    paddingTop: 20,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    gap: 4,
  },
  barValueLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    height: 13,
  },
  barTrack: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.alt,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 4,
    minHeight: 3,
  },
  barMonthLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },

  // Performance insights
  insightRow: { flexDirection: "row", gap: 8 },
  insightCard: {
    flex: 1,
    backgroundColor: COLORS.alt,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 12,
    gap: 2,
  },
  insightValue: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  insightSub: { color: COLORS.textMuted, fontSize: 10 },
  insightLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 4,
  },

  // Upsell
  upsellCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderStyle: "dashed",
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  upsellTitle: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  upsellBody: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  upsellBtn: {
    marginTop: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 28,
  },
  upsellBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
