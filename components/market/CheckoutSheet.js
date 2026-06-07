// components/market/CheckoutSheet.js
//
// Native checkout for marketplace listings.
// Phases: "review" → "card" → "success"
//
// - Review: order summary, delivery address, optional wallet credit
// - Card: Stripe raw API confirm (same pattern as WalletTopupSheet, but
//         accepts "requires_capture" since marketplace uses manual capture)
// - Success: confirmation + navigate to orders

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "expo-router";
import { COLORS } from "../../theme/colors";
import {
  WalletBalanceDocument,
  CreateCartOrdersDocument,
} from "../../graphql/documents";

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(pounds) {
  return `£${Number(pounds || 0).toFixed(2)}`;
}

function formatCardNumber(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function encodeForm(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

// Marketplace orders use manual capture — backend holds the payment until
// the seller ships, then captures. So we accept "requires_capture" as success.
async function confirmWithStripe(clientSecret, card) {
  const paymentIntentId = clientSecret.split("_secret_")[0];
  const [expMonth, expYear] = card.expiry.split("/");

  const body = encodeForm({
    // Required for client-side confirmation with a publishable key
    client_secret: clientSecret,
    "payment_method_data[type]": "card",
    "payment_method_data[card][number]": card.number.replace(/\s/g, ""),
    "payment_method_data[card][exp_month]": expMonth?.trim() ?? "",
    "payment_method_data[card][exp_year]": `20${expYear?.trim() ?? ""}`,
    "payment_method_data[card][cvc]": card.cvc,
  });

  const res = await fetch(
    `https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  if (json.status === "requires_action") {
    throw new Error(
      "This card requires 3D Secure verification. Please use a different card or pay with your wallet."
    );
  }
  // requires_capture = held; succeeded = immediate capture (both are OK)
  if (json.status !== "requires_capture" && json.status !== "succeeded") {
    throw new Error(`Payment not completed (status: ${json.status}).`);
  }
  return json;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function FieldInput({
  label, value, onChangeText, placeholder,
  keyboardType, autoCapitalize, maxLength, autoFocus,
  error,
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        autoCorrect={false}
        autoComplete="off"
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function CheckoutSheet({ visible, listing, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // phase: "review" | "card" | "success"
  const [phase, setPhase] = useState("review");

  // delivery address
  const [addr, setAddr] = useState({ line1: "", line2: "", city: "", postcode: "", country: "GB" });
  const [addrErrors, setAddrErrors] = useState({});

  // wallet
  const [useWallet, setUseWallet] = useState(false);

  // card inputs
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry]         = useState("");
  const [cvc, setCvc]               = useState("");

  // async state
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // orders returned from createCartOrders — held between phases
  const ordersRef = useRef([]);

  // wallet balance (lightweight query — limit:0 skips transactions)
  const { data: walletData } = useQuery(WalletBalanceDocument, {
    fetchPolicy: "cache-and-network",
    skip: !visible,
  });

  const [createCartOrders] = useMutation(CreateCartOrdersDocument);

  const walletBalance     = walletData?.myWallet?.balance ?? 0; // in £
  const walletBalancePence = Math.round(walletBalance * 100);

  const price      = Number(listing?.price ?? 0);
  const pricePence = Math.round(price * 100);

  const walletAppliedPence = useWallet
    ? Math.min(walletBalancePence, pricePence)
    : 0;
  const cardAmountPence = pricePence - walletAppliedPence;
  const isFullyWallet   = walletAppliedPence >= pricePence && pricePence > 0;

  // listing display info
  const cardName = listing?.cardInfo?.name ?? listing?.cardId ?? "Card";
  const cardImg  = listing?.cardInfo?.imageSmall ?? null;
  const condition = listing?.condition ?? "";
  const setName  = listing?.cardInfo?.setName ?? "";
  const seller   = listing?.seller?.username ?? "";
  const currency = listing?.currency ?? "GBP";

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  function reset() {
    setPhase("review");
    setAddr({ line1: "", line2: "", city: "", postcode: "", country: "GB" });
    setAddrErrors({});
    setUseWallet(false);
    setCardNumber(""); setExpiry(""); setCvc("");
    setError(""); setLoading(false);
    ordersRef.current = [];
  }

  // Reset whenever the sheet opens with a new listing
  useEffect(() => {
    if (visible) reset();
  }, [listing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    reset();
    onClose();
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateAddress() {
    const errs = {};
    if (!addr.line1.trim()) errs.line1 = "Required";
    if (!addr.city.trim()) errs.city = "Required";
    if (!addr.postcode.trim()) errs.postcode = "Required";
    return errs;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleContinue() {
    const errs = validateAddress();
    if (Object.keys(errs).length) { setAddrErrors(errs); return; }
    setAddrErrors({});
    setError("");
    setLoading(true);
    try {
      const items = [
        {
          listingId: listing.id,
          buyerAddress: {
            line1:    addr.line1.trim(),
            ...(addr.line2.trim() ? { line2: addr.line2.trim() } : {}),
            city:     addr.city.trim(),
            postcode: addr.postcode.trim().toUpperCase(),
            country:  addr.country || "GB",
          },
        },
      ];
      const walletAmountPence = useWallet ? walletAppliedPence : 0;

      const { data } = await createCartOrders({
        variables: { items, walletAmountPence },
      });
      const result = data?.createCartOrders;

      if (!result?.orders?.length) {
        const msg =
          result?.errors?.map((e) => e.error).join("; ") ||
          "Failed to create order. Please try again.";
        setError(msg);
        return;
      }

      ordersRef.current = result.orders;

      const needsCard = result.orders.some((o) => o.clientSecret);
      if (!needsCard) {
        // fully wallet-paid — skip card step
        setPhase("success");
        onSuccess?.();
      } else {
        setPhase("card");
      }
    } catch (e) {
      setError(e.message || "Failed to prepare order.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13) { setError("Enter a valid card number."); return; }
    if (expiry.length < 5)  { setError("Enter a valid expiry (MM/YY)."); return; }
    if (cvc.length < 3)     { setError("Enter your CVC."); return; }

    setError("");
    setLoading(true);
    try {
      for (const order of ordersRef.current) {
        if (!order.clientSecret) continue;
        await confirmWithStripe(order.clientSecret, { number: cardNumber, expiry, cvc });
      }
      setPhase("success");
      onSuccess?.();
    } catch (e) {
      setError(e.message || "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const headerTitle =
    phase === "card"    ? "Payment" :
    phase === "success" ? "Order confirmed" :
    "Checkout";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <View style={styles.header}>
            {phase === "card" ? (
              <Pressable onPress={() => { setPhase("review"); setError(""); }} hitSlop={8}>
                <Text style={styles.navText}>← Back</Text>
              </Pressable>
            ) : (
              <View style={{ width: 52 }} />
            )}
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={styles.navText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Error banner ─────────────────────────────────────── */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ═══════════════════════════════════════════════════════
                REVIEW PHASE
            ═══════════════════════════════════════════════════════ */}
            {phase === "review" && (
              <>
                {/* Order summary */}
                <View style={styles.section}>
                  <SectionLabel>Order summary</SectionLabel>
                  <View style={styles.listingRow}>
                    {cardImg ? (
                      <Image
                        source={{ uri: cardImg }}
                        style={styles.cardThumb}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={[styles.cardThumb, styles.cardThumbFallback]} />
                    )}
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.cardName} numberOfLines={2}>{cardName}</Text>
                      {setName ? <Text style={styles.cardMeta}>{setName}</Text> : null}
                      {condition ? <Text style={styles.cardMeta}>{condition}</Text> : null}
                      {seller ? <Text style={styles.cardMeta}>Sold by @{seller}</Text> : null}
                    </View>
                    <Text style={styles.listingPrice}>{fmt(price)}</Text>
                  </View>
                </View>

                {/* Delivery address */}
                <View style={styles.section}>
                  <SectionLabel>Delivery address</SectionLabel>
                  <FieldInput
                    label="Address line 1 *"
                    value={addr.line1}
                    onChangeText={(v) => {
                      setAddr((a) => ({ ...a, line1: v }));
                      setAddrErrors((e) => ({ ...e, line1: undefined }));
                    }}
                    placeholder="1 High Street"
                    error={addrErrors.line1}
                  />
                  <FieldInput
                    label="Address line 2"
                    value={addr.line2}
                    onChangeText={(v) => setAddr((a) => ({ ...a, line2: v }))}
                    placeholder="Flat 2 (optional)"
                  />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldInput
                        label="City *"
                        value={addr.city}
                        onChangeText={(v) => {
                          setAddr((a) => ({ ...a, city: v }));
                          setAddrErrors((e) => ({ ...e, city: undefined }));
                        }}
                        placeholder="London"
                        error={addrErrors.city}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldInput
                        label="Postcode *"
                        value={addr.postcode}
                        onChangeText={(v) => {
                          setAddr((a) => ({ ...a, postcode: v.toUpperCase() }));
                          setAddrErrors((e) => ({ ...e, postcode: undefined }));
                        }}
                        placeholder="SW1A 1AA"
                        autoCapitalize="characters"
                        error={addrErrors.postcode}
                      />
                    </View>
                  </View>
                </View>

                {/* Wallet credit — only shown if balance > 0 */}
                {walletBalancePence > 0 && (
                  <View style={styles.section}>
                    <SectionLabel>Wallet credit</SectionLabel>
                    <View style={styles.walletToggleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.walletToggleLabel}>Apply wallet balance</Text>
                        <Text style={styles.walletToggleSub}>
                          {fmt(walletBalance)} available
                        </Text>
                      </View>
                      <Switch
                        value={useWallet}
                        onValueChange={setUseWallet}
                        trackColor={{ false: COLORS.border, true: COLORS.accent }}
                        thumbColor="#fff"
                      />
                    </View>
                    {useWallet && (
                      <View style={styles.walletBreakdown}>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Wallet applied</Text>
                          <Text style={[styles.breakdownValue, { color: "#10b981" }]}>
                            −{fmt(walletAppliedPence / 100)}
                          </Text>
                        </View>
                        {!isFullyWallet && (
                          <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Remaining by card</Text>
                            <Text style={styles.breakdownValue}>
                              {fmt(cardAmountPence / 100)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Total row */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{fmt(price)}</Text>
                </View>

                <Pressable
                  onPress={handleContinue}
                  disabled={loading}
                  style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {isFullyWallet
                        ? `Pay ${fmt(price)} with wallet`
                        : "Continue to payment"}
                    </Text>
                  )}
                </Pressable>

                <Text style={styles.smallPrint}>
                  Your payment is authorised and held securely. It is only captured once
                  your item has been shipped.
                </Text>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════
                CARD PHASE
            ═══════════════════════════════════════════════════════ */}
            {phase === "card" && (
              <>
                {/* Payment breakdown recap */}
                <View style={styles.section}>
                  <SectionLabel>Payment breakdown</SectionLabel>
                  {walletAppliedPence > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Wallet credit</Text>
                      <Text style={[styles.breakdownValue, { color: "#10b981" }]}>
                        −{fmt(walletAppliedPence / 100)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { fontWeight: "800" }]}>
                      Card payment
                    </Text>
                    <Text style={[styles.breakdownValue, { fontWeight: "900", fontSize: 16 }]}>
                      {fmt(cardAmountPence / 100)}
                    </Text>
                  </View>
                </View>

                {/* Card details */}
                <View style={styles.section}>
                  <SectionLabel>Card details</SectionLabel>
                  <FieldInput
                    label="Card number"
                    value={cardNumber}
                    onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                    placeholder="1234 5678 9012 3456"
                    keyboardType="numeric"
                    autoCapitalize="none"
                    maxLength={19}
                    autoFocus
                  />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldInput
                        label="Expiry"
                        value={expiry}
                        onChangeText={(v) => setExpiry(formatExpiry(v))}
                        placeholder="MM/YY"
                        keyboardType="numeric"
                        autoCapitalize="none"
                        maxLength={5}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldInput
                        label="CVC"
                        value={cvc}
                        onChangeText={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                        keyboardType="numeric"
                        autoCapitalize="none"
                        maxLength={4}
                      />
                    </View>
                  </View>
                  <Text style={styles.secureNote}>🔒 Processed securely by Stripe</Text>
                </View>

                <Pressable
                  onPress={handlePay}
                  disabled={loading}
                  style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Pay {fmt(cardAmountPence / 100)} by card
                    </Text>
                  )}
                </Pressable>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════
                SUCCESS PHASE
            ═══════════════════════════════════════════════════════ */}
            {phase === "success" && (
              <View style={[styles.section, styles.successSection]}>
                <View style={styles.successIcon}>
                  <Text style={{ fontSize: 36, color: "#10b981" }}>✓</Text>
                </View>
                <View style={{ alignItems: "center", gap: 6 }}>
                  <Text style={styles.successTitle}>Order confirmed!</Text>
                  <Text style={styles.successSub}>
                    The seller will pack and ship your item. You'll be notified when
                    tracking details are added.
                  </Text>
                </View>
                <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => {
                      handleClose();
                      router.push("/(tabs)/market");
                    }}
                  >
                    <Text style={styles.primaryBtnText}>View my orders</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={handleClose}>
                    <Text style={styles.secondaryBtnText}>Done</Text>
                  </Pressable>
                </View>
              </View>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  navText: { color: COLORS.accent, fontWeight: "700", fontSize: 15, minWidth: 52 },

  body: { padding: 16, gap: 14, paddingBottom: 40 },

  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    borderColor: "#ef444455",
    backgroundColor: "#ef444411",
  },
  errorText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // listing summary
  listingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardThumb: { width: 56, height: 76, borderRadius: 6 },
  cardThumbFallback: { backgroundColor: COLORS.alt },
  cardName: { color: COLORS.text, fontWeight: "700", fontSize: 15, lineHeight: 20 },
  cardMeta: { color: COLORS.textMuted, fontSize: 12 },
  listingPrice: { color: COLORS.text, fontWeight: "900", fontSize: 18 },

  // address fields
  fieldLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  fieldError: { color: "#ef4444", fontSize: 11, marginTop: -4 },
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
  inputError: { borderColor: "#ef4444" },

  // wallet
  walletToggleRow: { flexDirection: "row", alignItems: "center" },
  walletToggleLabel: { color: COLORS.text, fontWeight: "700", fontSize: 15 },
  walletToggleSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  walletBreakdown: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },

  // breakdown
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { color: COLORS.textMuted, fontSize: 14 },
  breakdownValue: { color: COLORS.text, fontWeight: "700", fontSize: 14 },

  // total
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  totalLabel: { color: COLORS.textMuted, fontWeight: "700", fontSize: 15 },
  totalValue: { color: COLORS.text, fontWeight: "900", fontSize: 22 },

  // card form
  secureNote: { color: COLORS.textMuted, fontSize: 11, textAlign: "center" },
  smallPrint: { color: COLORS.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16 },

  // buttons
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: COLORS.surface,
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: "700" },

  // success
  successSection: { alignItems: "center", paddingVertical: 32, gap: 16 },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10b98122",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { color: COLORS.text, fontWeight: "900", fontSize: 22, textAlign: "center" },
  successSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
