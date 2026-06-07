// components/market/TradeDetailSheet.js
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useLazyQuery } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  SetTradeShippingAddressDocument,
  ShipTradeDocument,
  QuoteTradeShippingDocument,
  ConfirmTradeReceivedDocument,
  RaiseTradeDisputeDocument,
  LeaveTradeFleedbackDocument,
} from "../../graphql/documents";
import { getApiBase } from "../../utils/getApiBase";

function resolveUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${getApiBase()}${url}`;
}

function SectionBox({ children }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function ActionBtn({ label, onPress, disabled, loading, variant = "default", style }) {
  const bg =
    variant === "accent"  ? COLORS.accent :
    variant === "success" ? "#10b98122" :
    variant === "danger"  ? "#ef444422" :
    COLORS.alt;
  const border =
    variant === "accent"  ? COLORS.accent :
    variant === "success" ? "#10b98155" :
    variant === "danger"  ? "#ef444455" :
    COLORS.border;
  const textColor =
    variant === "accent"  ? "#fff" :
    variant === "success" ? "#10b981" :
    variant === "danger"  ? "#ef4444" :
    COLORS.textMuted;

  return (
    <Pressable
      style={[styles.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }, style]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[styles.btnText, { color: textColor }]}>{label}</Text>}
    </Pressable>
  );
}

function StarRating({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Text style={{ fontSize: 28, color: n <= value ? "#f59e0b" : COLORS.border }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TradeDetailSheet({ trade, myUserId, visible, onClose, onRefresh }) {
  const insets = useSafeAreaInsets();

  // phases: "detail" | "address" | "dispute" | "feedback"
  const [phase, setPhase] = useState("detail");

  // address form
  const [addrName,     setAddrName]     = useState("");
  const [addrLine1,    setAddrLine1]    = useState("");
  const [addrCity,     setAddrCity]     = useState("");
  const [addrPostcode, setAddrPostcode] = useState("");

  // shipping
  const [shipResult,    setShipResult]    = useState(null);
  const [shippingQuote, setShippingQuote] = useState(null);

  // dispute
  const [disputeReason, setDisputeReason] = useState("");

  // feedback
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackReview, setFeedbackReview] = useState("");
  const [feedbackDone,   setFeedbackDone]   = useState(false);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg,   setErrorMsg]   = useState("");

  const [setTradeAddress, { loading: addrLoading }]     = useMutation(SetTradeShippingAddressDocument);
  const [shipTrade,       { loading: shipLoading }]     = useMutation(ShipTradeDocument);
  const [confirmReceived, { loading: confirmLoading }]  = useMutation(ConfirmTradeReceivedDocument);
  const [raiseDispute,    { loading: disputeLoading }]  = useMutation(RaiseTradeDisputeDocument);
  const [leaveFeedback,   { loading: feedbackLoading }] = useMutation(LeaveTradeFleedbackDocument);

  const [fetchQuote, { loading: quoteLoading }] = useLazyQuery(QuoteTradeShippingDocument, {
    fetchPolicy: "network-only",
    onCompleted: (data) => setShippingQuote(data?.quoteTradeShipping ?? null),
    onError: (e) => setErrorMsg(`Could not get quote: ${e.message}`),
  });

  function handleClose() {
    setPhase("detail");
    setAddrName(""); setAddrLine1(""); setAddrCity(""); setAddrPostcode("");
    setShipResult(null); setShippingQuote(null);
    setDisputeReason("");
    setFeedbackRating(0); setFeedbackReview(""); setFeedbackDone(false);
    setSuccessMsg(""); setErrorMsg("");
    onClose();
  }

  if (!trade) return null;

  const isPartyA      = trade.partyAId === myUserId;
  const myAddressSet  = isPartyA ? trade.addressASet  : trade.addressBSet;
  const otherAddrSet  = isPartyA ? trade.addressBSet  : trade.addressASet;
  const myTracking    = isPartyA ? trade.trackingNumberA : trade.trackingNumberB;
  const otherTracking = isPartyA ? trade.trackingNumberB : trade.trackingNumberA;
  const status        = trade.status;

  const canShip            = (status === "LOCKED" || status === "IN_TRANSIT") && !myTracking;
  const canConfirmReceived = status === "IN_TRANSIT" && !!otherTracking;
  const canDispute         = status === "IN_TRANSIT";
  const canFeedback        = status === "COMPLETED" && !feedbackDone;

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleSaveAddress() {
    if (!addrPostcode.trim()) { setErrorMsg("Postcode is required."); return; }
    setErrorMsg("");
    try {
      await setTradeAddress({
        variables: {
          id: trade.id,
          address: {
            name: addrName, line1: addrLine1, city: addrCity,
            postcode: addrPostcode.trim().toUpperCase(), country: "GB",
          },
        },
      });
      setSuccessMsg("Address saved.");
      setPhase("detail");
      onRefresh?.();
    } catch (e) { setErrorMsg(e.message); }
  }

  async function handleShip() {
    setErrorMsg("");
    try {
      const { data } = await shipTrade({ variables: { id: trade.id, parcelSize: "LARGE_LETTER" } });
      const res = data?.shipTrade;
      if (res?.ok) {
        setShipResult(res);
        setSuccessMsg("Label generated — cards marked as in transit.");
        onRefresh?.();
      }
    } catch (e) { setErrorMsg(e.message); }
  }

  async function handleConfirmReceived() {
    setErrorMsg("");
    try {
      await confirmReceived({ variables: { id: trade.id } });
      setSuccessMsg("Receipt confirmed — trade marked as complete.");
      onRefresh?.();
    } catch (e) { setErrorMsg(e.message); }
  }

  async function handleRaiseDispute() {
    if (!disputeReason.trim()) { setErrorMsg("Please describe the issue."); return; }
    setErrorMsg("");
    try {
      await raiseDispute({ variables: { id: trade.id, reason: disputeReason.trim() } });
      setSuccessMsg("Dispute raised. Our team will review it.");
      setPhase("detail");
      onRefresh?.();
    } catch (e) { setErrorMsg(e.message); }
  }

  async function handleLeaveFeedback() {
    if (!feedbackRating) { setErrorMsg("Please select a star rating."); return; }
    setErrorMsg("");
    try {
      await leaveFeedback({ variables: { id: trade.id, rating: feedbackRating, review: feedbackReview || null } });
      setFeedbackDone(true);
      setSuccessMsg("Thanks for your feedback!");
    } catch (e) { setErrorMsg(e.message); }
  }

  // ── derived header ────────────────────────────────────────────────────────

  const headerTitle =
    phase === "dispute"  ? "Raise Dispute" :
    phase === "feedback" ? "Leave Feedback" :
    phase === "address"  ? "Shipping Address" :
    status === "COMPLETED" ? "Trade Complete" :
    "Trade Actions";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>

        <View style={styles.header}>
          <Pressable
            onPress={phase !== "detail" ? () => { setPhase("detail"); setErrorMsg(""); } : handleClose}
            hitSlop={8}
          >
            <Text style={styles.navText}>{phase !== "detail" ? "← Back" : "Done"}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {successMsg ? (
            <View style={[styles.banner, { borderColor: "#10b98155", backgroundColor: "#10b98111" }]}>
              <Text style={{ color: "#10b981", fontWeight: "700" }}>{successMsg}</Text>
            </View>
          ) : null}
          {errorMsg ? (
            <View style={[styles.banner, { borderColor: "#ef444455", backgroundColor: "#ef444411" }]}>
              <Text style={{ color: "#ef4444", fontWeight: "700" }}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* ── ADDRESS PHASE ─────────────────────────────────────── */}
          {phase === "address" && (
            <SectionBox>
              <SectionTitle>Your shipping address</SectionTitle>
              <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={COLORS.textMuted}
                value={addrName} onChangeText={setAddrName} />
              <TextInput style={styles.input} placeholder="Address line 1" placeholderTextColor={COLORS.textMuted}
                value={addrLine1} onChangeText={setAddrLine1} />
              <TextInput style={styles.input} placeholder="City / town" placeholderTextColor={COLORS.textMuted}
                value={addrCity} onChangeText={setAddrCity} />
              <TextInput style={styles.input} placeholder="Postcode *" placeholderTextColor={COLORS.textMuted}
                value={addrPostcode} onChangeText={setAddrPostcode} autoCapitalize="characters" />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <ActionBtn label="Back" onPress={() => setPhase("detail")} style={{ flex: 1 }} />
                <ActionBtn
                  label="Save address"
                  variant="accent"
                  onPress={handleSaveAddress}
                  loading={addrLoading}
                  disabled={addrLoading || !addrPostcode.trim()}
                  style={{ flex: 1 }}
                />
              </View>
            </SectionBox>
          )}

          {/* ── DISPUTE PHASE ─────────────────────────────────────── */}
          {phase === "dispute" && (
            <SectionBox>
              <SectionTitle>Describe the issue</SectionTitle>
              <Text style={styles.hint}>
                Explain what went wrong. Our team will review and may contact both parties.
              </Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                placeholder="What's the problem?"
                placeholderTextColor={COLORS.textMuted}
                value={disputeReason}
                onChangeText={setDisputeReason}
                multiline
              />
              <ActionBtn
                label="Submit dispute"
                variant="danger"
                onPress={handleRaiseDispute}
                loading={disputeLoading}
                disabled={disputeLoading || !disputeReason.trim()}
              />
            </SectionBox>
          )}

          {/* ── FEEDBACK PHASE ────────────────────────────────────── */}
          {phase === "feedback" && !feedbackDone && (
            <SectionBox>
              <SectionTitle>Rate this trade</SectionTitle>
              <StarRating value={feedbackRating} onChange={setFeedbackRating} />
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: "top", marginTop: 4 }]}
                placeholder="Leave a review (optional)"
                placeholderTextColor={COLORS.textMuted}
                value={feedbackReview}
                onChangeText={setFeedbackReview}
                multiline
              />
              <ActionBtn
                label="Submit feedback"
                variant="accent"
                onPress={handleLeaveFeedback}
                loading={feedbackLoading}
                disabled={feedbackLoading || !feedbackRating}
              />
            </SectionBox>
          )}

          {/* ── DETAIL PHASE ──────────────────────────────────────── */}
          {phase === "detail" && (
            <>
              {/* Shipping steps */}
              {canShip && (
                <SectionBox>
                  <SectionTitle>Step 1 — your address</SectionTitle>
                  {myAddressSet ? (
                    <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 13 }}>✓ Your address is saved</Text>
                  ) : (
                    <ActionBtn label="Share my shipping address" variant="accent" onPress={() => setPhase("address")} />
                  )}
                </SectionBox>
              )}

              {canShip && myAddressSet && !otherAddrSet && (
                <SectionBox>
                  <SectionTitle>Step 2 — other party's address</SectionTitle>
                  <Text style={styles.hint}>
                    Waiting for the other party to share their address before you can generate a label.
                  </Text>
                </SectionBox>
              )}

              {canShip && myAddressSet && otherAddrSet && !shipResult && (
                <SectionBox>
                  <SectionTitle>Step 2 — pay & generate label</SectionTitle>
                  {!shippingQuote ? (
                    <>
                      <Text style={styles.hint}>Both addresses ready. Get a quote — cost charged to your wallet.</Text>
                      <ActionBtn
                        label="Get shipping quote"
                        variant="accent"
                        onPress={() => fetchQuote({ variables: { id: trade.id } })}
                        loading={quoteLoading}
                        disabled={quoteLoading}
                      />
                    </>
                  ) : (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Shipping cost</Text>
                        <Text style={[styles.infoValue, { fontWeight: "800" }]}>£{shippingQuote.amount?.toFixed(2)}</Text>
                      </View>
                      {shippingQuote.carrier && (
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Carrier</Text>
                          <Text style={styles.infoValue}>{shippingQuote.carrier}</Text>
                        </View>
                      )}
                      <Text style={styles.hint}>Deducted from your wallet.</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <ActionBtn label="Cancel" onPress={() => setShippingQuote(null)} style={{ flex: 1 }} />
                        <ActionBtn
                          label={`Pay £${shippingQuote.amount?.toFixed(2)} & ship`}
                          variant="accent"
                          onPress={handleShip}
                          loading={shipLoading}
                          disabled={shipLoading}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </>
                  )}
                </SectionBox>
              )}

              {/* My label result */}
              {(shipResult || myTracking) && (
                <SectionBox>
                  <SectionTitle>Your shipping label</SectionTitle>
                  {(shipResult?.trackingNumber || myTracking) && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Tracking #</Text>
                      <Text style={styles.infoValue}>{shipResult?.trackingNumber || myTracking}</Text>
                    </View>
                  )}
                  {shipResult?.carrier && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Carrier</Text>
                      <Text style={styles.infoValue}>{shipResult.carrier}</Text>
                    </View>
                  )}
                  {shipResult?.labelUrl && (
                    <ActionBtn label="Download / print label →" onPress={() => Linking.openURL(resolveUrl(shipResult.labelUrl))} />
                  )}
                  {shipResult?.trackingUrl && (
                    <ActionBtn label="Track parcel →" onPress={() => Linking.openURL(shipResult.trackingUrl)} />
                  )}
                </SectionBox>
              )}

              {/* Other party status */}
              {status === "IN_TRANSIT" && (
                <SectionBox>
                  <SectionTitle>Other party</SectionTitle>
                  {otherTracking ? (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Their tracking #</Text>
                        <Text style={[styles.infoValue, { fontSize: 12 }]}>{otherTracking}</Text>
                      </View>
                      <Text style={[styles.hint, { marginTop: 2 }]}>
                        Cards are on their way. Confirm receipt once they arrive.
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.hint}>Waiting for the other party to ship their cards.</Text>
                  )}
                </SectionBox>
              )}

              {/* Confirm received */}
              {canConfirmReceived && (
                <SectionBox>
                  <SectionTitle>Confirm receipt</SectionTitle>
                  <Text style={styles.hint}>
                    Only confirm once you've physically received the cards in good condition.
                  </Text>
                  <ActionBtn
                    label="I've received my cards ✓"
                    variant="success"
                    onPress={handleConfirmReceived}
                    loading={confirmLoading}
                    disabled={confirmLoading}
                  />
                </SectionBox>
              )}

              {/* Raise dispute */}
              {canDispute && (
                <SectionBox>
                  <SectionTitle>Problem?</SectionTitle>
                  <Text style={styles.hint}>
                    Cards not arrived, damaged, or not as described?
                  </Text>
                  <ActionBtn
                    label="Raise a dispute"
                    variant="danger"
                    onPress={() => { setErrorMsg(""); setPhase("dispute"); }}
                  />
                </SectionBox>
              )}

              {/* Leave feedback */}
              {canFeedback && (
                <SectionBox>
                  <SectionTitle>Rate this trade</SectionTitle>
                  <Text style={styles.hint}>How did it go? Your feedback helps the community.</Text>
                  <ActionBtn
                    label="Leave feedback →"
                    variant="accent"
                    onPress={() => { setErrorMsg(""); setPhase("feedback"); }}
                  />
                </SectionBox>
              )}

              {status === "COMPLETED" && feedbackDone && (
                <SectionBox>
                  <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 14, textAlign: "center" }}>
                    ✓ Trade complete
                  </Text>
                </SectionBox>
              )}
            </>
          )}

        </ScrollView>
      </View>
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
  body: { padding: 14, gap: 10, paddingBottom: 40 },
  banner: { borderWidth: 1, borderRadius: 10, padding: 12 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  input: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    color: COLORS.text,
    fontSize: 13,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "700", fontSize: 13 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { color: COLORS.textMuted, fontSize: 13 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
});
