// components/wallet/WalletSheet.js
// Full wallet view: balance card, transaction history, withdrawal form.
// Opens WalletTopupSheet internally for top-ups.

import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  WalletDetailDocument,
  RequestWithdrawalDocument,
} from "../../graphql/documents";
import WalletTopupSheet from "./WalletTopupSheet";

const PAGE_SIZE = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSortCode(raw) {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Prettify machine-readable type strings
function labelType(type) {
  switch (type) {
    case "topup":        return "Top-up";
    case "sale_credit":  return "Sale";
    case "trade_credit": return "Trade";
    case "withdrawal":   return "Withdrawal";
    case "refund":       return "Refund";
    case "fee":          return "Fee";
    default:             return type ?? "Transaction";
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function Field({ label, children }) {
  return (
    <View style={{ gap: 4 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function WalletSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("history"); // "history" | "withdraw"
  const [showTopup, setShowTopup] = useState(false);

  // Withdraw form
  const [form, setForm] = useState({
    amount: "",
    sortCode: "",
    accountNumber: "",
    accountName: "",
  });
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const { data, loading, refetch } = useQuery(WalletDetailDocument, {
    variables: { limit: PAGE_SIZE, offset: 0 },
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const [requestWithdrawal] = useMutation(RequestWithdrawalDocument);

  const wallet = data?.myWallet;
  const balance = wallet?.balance ?? 0;
  const held = wallet?.held ?? 0;
  const txs = wallet?.transactions ?? [];

  function handleClose() {
    setTab("history");
    setForm({ amount: "", sortCode: "", accountNumber: "", accountName: "" });
    setWithdrawError("");
    setWithdrawSuccess("");
    setWithdrawLoading(false);
    onClose();
  }

  async function handleWithdraw() {
    setWithdrawError("");
    setWithdrawSuccess("");
    const amountPence = Math.round(parseFloat(form.amount || "0") * 100);
    if (amountPence < 500) {
      setWithdrawError("Minimum withdrawal is £5.00.");
      return;
    }
    if (amountPence > Math.round(balance * 100)) {
      setWithdrawError("Amount exceeds your available balance.");
      return;
    }
    const sc = form.sortCode.replace(/-/g, "");
    if (sc.length !== 6) {
      setWithdrawError("Sort code must be 6 digits (e.g. 12-34-56).");
      return;
    }
    const an = form.accountNumber.replace(/\D/g, "");
    if (an.length !== 8) {
      setWithdrawError("Account number must be 8 digits.");
      return;
    }
    if (!form.accountName.trim()) {
      setWithdrawError("Enter the account holder name.");
      return;
    }

    setWithdrawLoading(true);
    try {
      await requestWithdrawal({
        variables: {
          amountPence,
          sortCode: sc,
          accountNumber: an,
          accountName: form.accountName.trim(),
        },
      });
      setWithdrawSuccess(
        `Withdrawal of £${(amountPence / 100).toFixed(2)} requested. Funds arrive within 2–3 working days.`
      );
      setForm({ amount: "", sortCode: "", accountNumber: "", accountName: "" });
      refetch();
    } catch (e) {
      setWithdrawError(e.message || "Failed to request withdrawal.");
    } finally {
      setWithdrawLoading(false);
    }
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 48 }} />
            <Text style={styles.headerTitle}>My Wallet</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={styles.navText}>Done</Text>
            </Pressable>
          </View>

          {/* Balance card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available balance</Text>
            <Text style={styles.balanceAmount}>
              £{balance.toFixed(2)}
            </Text>
            {held > 0 && (
              <Text style={styles.heldText}>
                £{held.toFixed(2)} held (pending trades/orders)
              </Text>
            )}
            <View style={styles.balanceActions}>
              <Pressable
                onPress={() => setShowTopup(true)}
                style={styles.balanceBtn}
              >
                <Text style={styles.balanceBtnText}>+ Top up</Text>
              </Pressable>
              <Pressable
                onPress={() => setTab("withdraw")}
                style={[styles.balanceBtn, styles.balanceBtnAlt]}
              >
                <Text style={[styles.balanceBtnText, { color: "#fff" }]}>
                  Withdraw →
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {[
              { key: "history",  label: "History" },
              { key: "withdraw", label: "Withdraw" },
            ].map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, tab === t.key && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === t.key && styles.tabTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── HISTORY ──────────────────────────────────────────────── */}
          {tab === "history" && (
            loading && !wallet ? (
              <View style={styles.center}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : txs.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>💳</Text>
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptyBody}>
                  Top up your wallet to get started.
                </Text>
              </View>
            ) : (
              <FlatList
                data={txs}
                keyExtractor={(tx) => tx.id}
                contentContainerStyle={{ padding: 14, gap: 8 }}
                refreshControl={
                  <RefreshControl
                    refreshing={loading}
                    onRefresh={refetch}
                    tintColor={COLORS.accent}
                  />
                }
                renderItem={({ item: tx }) => {
                  const isCredit = tx.amount > 0;
                  return (
                    <View style={styles.txRow}>
                      <View
                        style={[
                          styles.txIcon,
                          {
                            backgroundColor: isCredit
                              ? "#10b98120"
                              : "#ef444420",
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: isCredit ? "#10b981" : "#ef4444",
                            fontWeight: "900",
                            fontSize: 16,
                          }}
                        >
                          {isCredit ? "+" : "−"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txDesc}>
                          {tx.description || labelType(tx.type)}
                        </Text>
                        <Text style={styles.txDate}>
                          {timeAgo(tx.createdAt)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.txAmount,
                          { color: isCredit ? "#10b981" : "#ef4444" },
                        ]}
                      >
                        {isCredit ? "+" : "−"}£
                        {Math.abs(tx.amount).toFixed(2)}
                      </Text>
                    </View>
                  );
                }}
              />
            )
          )}

          {/* ── WITHDRAW ─────────────────────────────────────────────── */}
          {tab === "withdraw" && (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
              <ScrollView
                contentContainerStyle={styles.withdrawBody}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Bank transfer</Text>
                  <Text style={styles.withdrawNote}>
                    Withdrawals are processed manually within 2–3 working days.
                    Minimum withdrawal is £5.00.
                  </Text>

                  {withdrawSuccess ? (
                    <View style={styles.successBanner}>
                      <Text style={styles.successText}>{withdrawSuccess}</Text>
                    </View>
                  ) : null}

                  {withdrawError ? (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>{withdrawError}</Text>
                    </View>
                  ) : null}

                  <Field label="Amount (£)">
                    <TextInput
                      style={styles.input}
                      value={form.amount}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, amount: v }))
                      }
                      placeholder={`Max £${balance.toFixed(2)}`}
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </Field>

                  <Field label="Sort code">
                    <TextInput
                      style={styles.input}
                      value={form.sortCode}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, sortCode: formatSortCode(v) }))
                      }
                      placeholder="12-34-56"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={8}
                    />
                  </Field>

                  <Field label="Account number">
                    <TextInput
                      style={styles.input}
                      value={form.accountNumber}
                      onChangeText={(v) =>
                        setForm((f) => ({
                          ...f,
                          accountNumber: v.replace(/\D/g, "").slice(0, 8),
                        }))
                      }
                      placeholder="12345678"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={8}
                    />
                  </Field>

                  <Field label="Account holder name">
                    <TextInput
                      style={styles.input}
                      value={form.accountName}
                      onChangeText={(v) =>
                        setForm((f) => ({ ...f, accountName: v }))
                      }
                      placeholder="Jane Smith"
                      placeholderTextColor={COLORS.textMuted}
                      autoCorrect={false}
                    />
                  </Field>
                </View>

                <Pressable
                  onPress={handleWithdraw}
                  disabled={withdrawLoading}
                  style={[
                    styles.primaryBtn,
                    withdrawLoading && { opacity: 0.5 },
                  ]}
                >
                  {withdrawLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Request Withdrawal
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      <WalletTopupSheet
        visible={showTopup}
        onClose={() => setShowTopup(false)}
        onSuccess={() => {
          setShowTopup(false);
          refetch();
        }}
      />
    </>
  );
}

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

  balanceCard: {
    margin: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    padding: 20,
    gap: 4,
  },
  balanceLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700" },
  balanceAmount: { color: "#fff", fontSize: 38, fontWeight: "900" },
  heldText: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
  balanceActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  balanceBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  balanceBtnAlt: { backgroundColor: "rgba(255,255,255,0.2)" },
  balanceBtnText: { color: COLORS.accent, fontWeight: "800", fontSize: 14 },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  tabText: { color: COLORS.textMuted, fontWeight: "700" },
  tabTextActive: { color: COLORS.accent },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 17 },
  emptyBody: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 12,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  txDesc: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  txDate: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  txAmount: { fontWeight: "800", fontSize: 15 },

  withdrawBody: { padding: 16, gap: 14 },
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
  withdrawNote: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },

  successBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    borderColor: "#10b98155",
    backgroundColor: "#10b98111",
  },
  successText: { color: "#10b981", fontWeight: "700", fontSize: 13 },

  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    borderColor: "#ef444455",
    backgroundColor: "#ef444411",
  },
  errorText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  fieldLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  input: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 15,
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
