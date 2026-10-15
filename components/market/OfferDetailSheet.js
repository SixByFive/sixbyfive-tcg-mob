// components/market/OfferDetailSheet.js
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import CardImage from "../common/CardImage";
import { RespondToOfferDocument, WithdrawOfferDocument } from "../../graphql/documents";
import { OFFER_STATUS_META } from "./OfferRow";

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount) || 0);
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function timeLeft(d) {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Less than 1 hour";
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""}`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function SectionBox({ children }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function InfoRow({ label, value, valueStyle }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, onPress, disabled, loading, variant = "default", style }) {
  const bg = variant === "accent" ? COLORS.accent
    : variant === "danger" ? "#ef444422"
    : variant === "success" ? "#10b98122"
    : COLORS.alt;
  const border = variant === "accent" ? COLORS.accent
    : variant === "danger" ? "#ef444455"
    : variant === "success" ? "#10b98155"
    : COLORS.border;
  const textColor = variant === "accent" ? "#fff"
    : variant === "danger" ? "#ef4444"
    : variant === "success" ? "#10b981"
    : COLORS.textMuted;

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

export default function OfferDetailSheet({ offer, direction, visible, onClose, onRefresh }) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState("detail"); // "detail" | "counter" | "decline" | "withdraw"
  const [counterAmount, setCounterAmount] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [respondToOffer, { loading: respondLoading }] = useMutation(RespondToOfferDocument);
  const [withdrawOffer, { loading: withdrawLoading }] = useMutation(WithdrawOfferDocument);

  function handleClose() {
    setPhase("detail");
    setCounterAmount("");
    setCounterMessage("");
    setSuccessMsg("");
    setErrorMsg("");
    onClose();
  }

  if (!offer) return null;

  const status = (offer.status || "").toLowerCase();
  const meta = OFFER_STATUS_META[status] || { label: offer.status, color: COLORS.textMuted };
  const cardInfo = offer.listing?.cardInfo;
  const listingPrice = offer.listing?.price;
  const expiry = timeLeft(offer.expiresAt);

  const isIncoming = direction === "in";
  const isSent = direction === "out";

  const canAccept  = isIncoming && status === "pending";
  const canDecline = isIncoming && status === "pending";
  const canCounter = isIncoming && status === "pending";
  const canWithdraw = isSent && (status === "pending" || status === "countered");

  async function handleRespond(action, extra = {}) {
    setErrorMsg("");
    try {
      const { data } = await respondToOffer({
        variables: { offerId: offer.id, action, ...extra },
      });
      const res = data?.respondToOffer;
      if (res?.ok) {
        if (action === "accept") {
          setSuccessMsg("Offer accepted — order created. Check your Orders tab.");
        } else if (action === "decline") {
          setSuccessMsg("Offer declined.");
        } else if (action === "counter") {
          setSuccessMsg(`Counter offer of ${fmt(extra.counterAmount)} sent.`);
        }
        onRefresh?.();
      }
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  async function handleWithdraw() {
    setErrorMsg("");
    try {
      await withdrawOffer({ variables: { offerId: offer.id } });
      setSuccessMsg("Offer withdrawn.");
      onRefresh?.();
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  async function submitCounter() {
    const amount = parseFloat(counterAmount);
    if (!amount || amount <= 0) {
      setErrorMsg("Enter a valid counter amount.");
      return;
    }
    await handleRespond("counter", {
      counterAmount: amount,
      counterMessage: counterMessage || undefined,
    });
    setPhase("detail");
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isIncoming ? "Incoming offer" : "Sent offer"}
          </Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* Banners */}
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

          {/* Card + status */}
          <SectionBox>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <CardImage uri={cardInfo?.imageSmall} name={cardInfo?.name} cardId={cardInfo?.id} style={styles.cardImage} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.cardName}>{cardInfo?.name || "Card"}</Text>
                {cardInfo?.setName && <Text style={styles.setName}>{cardInfo.setName}</Text>}
                <View style={[styles.pill, { borderColor: meta.color + "55", backgroundColor: meta.color + "22", alignSelf: "flex-start", marginTop: 4 }]}>
                  <View style={[styles.pillDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
            </View>
          </SectionBox>

          {/* Offer details */}
          <SectionBox>
            <SectionTitle>Offer details</SectionTitle>
            <InfoRow label="Offer amount" value={fmt(offer.amount)} valueStyle={{ fontWeight: "800" }} />
            {listingPrice && <InfoRow label="Listed at" value={fmt(listingPrice)} />}
            {offer.message ? (
              <View style={styles.messageBox}>
                <Text style={styles.infoLabel}>Message</Text>
                <Text style={styles.messageText}>{offer.message}</Text>
              </View>
            ) : null}
            <InfoRow label="Sent" value={fmtDate(offer.createdAt)} />
            {status === "pending" && expiry && (
              <InfoRow
                label="Expires in"
                value={expiry}
                valueStyle={{ color: "#eab308", fontWeight: "700" }}
              />
            )}
          </SectionBox>

          {/* Counterparty */}
          {isIncoming && offer.buyer?.username && (
            <SectionBox>
              <SectionTitle>Buyer</SectionTitle>
              <Text style={styles.infoValue}>{offer.buyer.username}</Text>
            </SectionBox>
          )}
          {isSent && offer.listing?.seller?.username && (
            <SectionBox>
              <SectionTitle>Seller</SectionTitle>
              <Text style={styles.infoValue}>{offer.listing.seller.username}</Text>
            </SectionBox>
          )}

          {/* Counter details (visible to buyer when offer has been countered) */}
          {status === "countered" && offer.counterAmount && (
            <SectionBox>
              <SectionTitle>Counter offer</SectionTitle>
              <InfoRow
                label="Counter amount"
                value={fmt(offer.counterAmount)}
                valueStyle={{ fontWeight: "800", color: "#60a5fa" }}
              />
              {offer.counterMessage && (
                <View style={styles.messageBox}>
                  <Text style={styles.infoLabel}>Message</Text>
                  <Text style={styles.messageText}>{offer.counterMessage}</Text>
                </View>
              )}
              {isSent && (
                <Text style={styles.hint}>
                  To accept this counter, withdraw this offer and create a new offer at {fmt(offer.counterAmount)}.
                </Text>
              )}
            </SectionBox>
          )}

          {/* Accepted notice */}
          {status === "accepted" && (
            <SectionBox>
              <Text style={{ color: "#10b981", fontWeight: "700" }}>
                ✓ {isIncoming ? "You accepted this offer — an order has been created." : "Your offer was accepted — check your Orders tab."}
              </Text>
            </SectionBox>
          )}

          {/* ── Action panels ── */}

          {/* Counter panel (seller) */}
          {phase === "counter" && (
            <SectionBox>
              <SectionTitle>Send counter offer</SectionTitle>
              <Text style={styles.hint}>Enter the price you'd accept instead.</Text>
              <TextInput
                style={styles.input}
                placeholder="Counter amount (e.g. 12.50)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                value={counterAmount}
                onChangeText={setCounterAmount}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Message (optional)…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={counterMessage}
                onChangeText={setCounterMessage}
              />
              <View style={styles.btnRow}>
                <ActionBtn label="Back" onPress={() => { setPhase("detail"); setErrorMsg(""); }} style={{ flex: 1 }} />
                <ActionBtn
                  label="Send counter"
                  variant="accent"
                  onPress={submitCounter}
                  loading={respondLoading}
                  disabled={respondLoading || !counterAmount}
                  style={{ flex: 1 }}
                />
              </View>
            </SectionBox>
          )}

          {/* Withdraw confirmation (buyer) */}
          {phase === "withdraw" && (
            <SectionBox>
              <SectionTitle>Withdraw offer</SectionTitle>
              <Text style={styles.hint}>Are you sure? This cannot be undone.</Text>
              <View style={styles.btnRow}>
                <ActionBtn label="Back" onPress={() => setPhase("detail")} style={{ flex: 1 }} />
                <ActionBtn
                  label="Withdraw"
                  variant="danger"
                  onPress={handleWithdraw}
                  loading={withdrawLoading}
                  disabled={withdrawLoading}
                  style={{ flex: 1 }}
                />
              </View>
            </SectionBox>
          )}

          {/* Incoming offer actions (seller, pending) */}
          {phase === "detail" && canAccept && !successMsg && (
            <SectionBox>
              <SectionTitle>Respond to offer</SectionTitle>
              <ActionBtn
                label="Accept offer"
                variant="success"
                onPress={() => handleRespond("accept")}
                loading={respondLoading}
                disabled={respondLoading}
              />
              <ActionBtn
                label="Counter offer…"
                onPress={() => setPhase("counter")}
                disabled={respondLoading}
              />
              <ActionBtn
                label="Decline"
                variant="danger"
                onPress={() => handleRespond("decline")}
                loading={respondLoading}
                disabled={respondLoading}
              />
            </SectionBox>
          )}

          {/* Sent offer actions (buyer) */}
          {phase === "detail" && canWithdraw && !successMsg && (
            <View style={styles.btnRow}>
              <ActionBtn
                label="Withdraw offer"
                variant="danger"
                onPress={() => setPhase("withdraw")}
                style={{ flex: 1 }}
              />
            </View>
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
  doneText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
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
  cardImage: { width: 60, height: 84, borderRadius: 6 },
  cardName: { color: COLORS.text, fontWeight: "800", fontSize: 15 },
  setName: { color: COLORS.textMuted, fontSize: 11 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { color: COLORS.textMuted, fontSize: 13 },
  infoValue: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  messageBox: { gap: 4 },
  messageText: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
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
  textArea: { minHeight: 72, textAlignVertical: "top" },
  btn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "700", fontSize: 13 },
  btnRow: { flexDirection: "row", gap: 8 },
});
