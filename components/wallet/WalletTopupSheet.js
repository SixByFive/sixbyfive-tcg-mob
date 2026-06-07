// components/wallet/WalletTopupSheet.js
import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import { CreateTopupIntentDocument, ConfirmTopupDocument } from "../../graphql/documents";

const STRIPE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const PRESETS = [
  { label: "£5",  pence: 500 },
  { label: "£10", pence: 1000 },
  { label: "£20", pence: 2000 },
  { label: "£50", pence: 5000 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

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
    throw new Error("This card requires extra verification (3D Secure). Please use a different card.");
  }
  if (json.status !== "succeeded") {
    throw new Error(`Payment not completed (status: ${json.status}).`);
  }
  return json;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardInput({ label, value, onChangeText, placeholder, keyboardType, maxLength, style, autoFocus }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType ?? "numeric"}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoComplete="off"
      />
    </View>
  );
}

// ── Main sheet ────────────────────────────────────────────────────────────────

export default function WalletTopupSheet({ visible, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();

  // phase: "amount" | "card" | "success"
  const [phase, setPhase] = useState("amount");

  // amount
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customAmount, setCustomAmount] = useState("");

  // card
  const [cardNumber, setCardNumber] = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [cvc,        setCvc]        = useState("");
  const [cardName,   setCardName]   = useState("");

  // state
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [newBalance, setNewBalance] = useState(null);

  // intent data held between phases
  const intentRef = useRef({ clientSecret: "", paymentIntentId: "" });

  const [createIntent] = useMutation(CreateTopupIntentDocument);
  const [confirmTopup] = useMutation(ConfirmTopupDocument);

  function reset() {
    setPhase("amount");
    setSelectedPreset(null); setCustomAmount("");
    setCardNumber(""); setExpiry(""); setCvc(""); setCardName("");
    setError(""); setLoading(false); setNewBalance(null);
    intentRef.current = { clientSecret: "", paymentIntentId: "" };
  }

  function handleClose() { reset(); onClose(); }

  const amountPence = selectedPreset != null
    ? PRESETS[selectedPreset].pence
    : Math.round(parseFloat(customAmount || "0") * 100);

  const amountLabel = amountPence > 0 ? `£${(amountPence / 100).toFixed(2)}` : "";

  async function handleContinue() {
    if (amountPence < 100) { setError("Minimum top-up is £1.00."); return; }
    setError(""); setLoading(true);
    try {
      const { data } = await createIntent({ variables: { amountPence } });
      const { clientSecret, paymentIntentId } = data.createTopupIntent;
      intentRef.current = { clientSecret, paymentIntentId };
      setPhase("card");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13) { setError("Enter a valid card number."); return; }
    if (expiry.length < 5)  { setError("Enter a valid expiry (MM/YY)."); return; }
    if (cvc.length < 3)     { setError("Enter your CVC."); return; }

    setError(""); setLoading(true);
    try {
      const paymentIntentId = intentRef.current.clientSecret.split("_secret_")[0];
      await confirmWithStripe(intentRef.current.clientSecret, { number: cardNumber, expiry, cvc });
      const { data } = await confirmTopup({ variables: { paymentIntentId } });
      setNewBalance(data?.confirmTopup?.balance ?? null);
      setPhase("success");
      onSuccess?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const headerTitle =
    phase === "card"    ? `Pay ${amountLabel}` :
    phase === "success" ? "Top-up complete" :
    "Top up wallet";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>

          <View style={styles.header}>
            {phase !== "amount" && phase !== "success" ? (
              <Pressable onPress={() => { setPhase("amount"); setError(""); }} hitSlop={8}>
                <Text style={styles.navText}>← Back</Text>
              </Pressable>
            ) : (
              <View style={{ width: 48 }} />
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

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ── AMOUNT PHASE ───────────────────────────────────── */}
            {phase === "amount" && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Select amount</Text>
                  <View style={styles.presetGrid}>
                    {PRESETS.map((p, i) => (
                      <Pressable
                        key={i}
                        onPress={() => { setSelectedPreset(i); setCustomAmount(""); setError(""); }}
                        style={[styles.presetChip, selectedPreset === i && styles.presetChipActive]}
                      >
                        <Text style={[styles.presetLabel, selectedPreset === i && styles.presetLabelActive]}>
                          {p.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.orDivider}>— or enter custom amount —</Text>
                  <View style={styles.customRow}>
                    <Text style={styles.currencySymbol}>£</Text>
                    <TextInput
                      style={styles.customInput}
                      value={customAmount}
                      onChangeText={v => { setCustomAmount(v); setSelectedPreset(null); setError(""); }}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Pressable
                  onPress={handleContinue}
                  disabled={loading || amountPence < 100}
                  style={[styles.primaryBtn, (loading || amountPence < 100) && { opacity: 0.5 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.primaryBtnText}>
                        {amountLabel ? `Continue with ${amountLabel}` : "Continue"}
                      </Text>}
                </Pressable>
              </>
            )}

            {/* ── CARD PHASE ─────────────────────────────────────── */}
            {phase === "card" && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Card details</Text>
                  <CardInput
                    label="Name on card"
                    value={cardName}
                    onChangeText={setCardName}
                    placeholder="Jane Smith"
                    keyboardType="default"
                    autoFocus
                  />
                  <CardInput
                    label="Card number"
                    value={cardNumber}
                    onChangeText={v => setCardNumber(formatCardNumber(v))}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                  />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <CardInput
                        label="Expiry"
                        value={expiry}
                        onChangeText={v => setExpiry(formatExpiry(v))}
                        placeholder="MM/YY"
                        maxLength={5}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <CardInput
                        label="CVC"
                        value={cvc}
                        onChangeText={v => setCvc(v.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                        maxLength={4}
                      />
                    </View>
                  </View>
                  <Text style={styles.secureNote}>🔒 Processed securely by Stripe</Text>
                </View>

                <Pressable
                  onPress={handlePay}
                  disabled={loading}
                  style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.primaryBtnText}>Pay {amountLabel}</Text>}
                </Pressable>
              </>
            )}

            {/* ── SUCCESS PHASE ──────────────────────────────────── */}
            {phase === "success" && (
              <View style={styles.section}>
                <View style={styles.successIcon}>
                  <Text style={{ fontSize: 40 }}>✓</Text>
                </View>
                <Text style={styles.successTitle}>{amountLabel} added to your wallet</Text>
                {newBalance != null && (
                  <Text style={styles.successBalance}>
                    New balance: £{Number(newBalance).toFixed(2)}
                  </Text>
                )}
                <Pressable onPress={handleClose} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Done</Text>
                </Pressable>
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
  navText: { color: COLORS.accent, fontWeight: "700", fontSize: 15, minWidth: 48 },
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
  sectionTitle: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  presetGrid: { flexDirection: "row", gap: 10 },
  presetChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: COLORS.alt,
  },
  presetChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  presetLabel: { color: COLORS.textMuted, fontWeight: "700", fontSize: 15 },
  presetLabelActive: { color: "#fff" },

  orDivider: { color: COLORS.textMuted, fontSize: 11, textAlign: "center" },

  customRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  currencySymbol: { color: COLORS.text, fontSize: 18, fontWeight: "700", marginRight: 4 },
  customInput: { flex: 1, color: COLORS.text, fontSize: 22, fontWeight: "700", paddingVertical: 12 },

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
    letterSpacing: 0.5,
  },
  secureNote: { color: COLORS.textMuted, fontSize: 11, textAlign: "center", marginTop: 2 },

  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  successIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#10b98122",
    alignSelf: "center",
  },
  successTitle: { color: COLORS.text, fontWeight: "800", fontSize: 18, textAlign: "center" },
  successBalance: { color: COLORS.textMuted, fontSize: 14, textAlign: "center" },
});
