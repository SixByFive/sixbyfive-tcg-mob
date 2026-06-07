// components/market/OrderDetailSheet.js
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import { getApiBase } from "../../utils/getApiBase";
import {
  ShipOrderDocument,
  ConfirmOrderReceivedDocument,
  RaiseOrderDisputeDocument,
  CancelOrderDocument,
  LeaveOrderFeedbackDocument,
} from "../../graphql/documents";

const FULFILMENT_META = {
  pending:           { label: "Pending",           color: "#eab308" },
  awaiting_shipment: { label: "Awaiting shipment", color: "#f97316" },
  shipped:           { label: "Shipped",           color: "#22d3ee" },
  completed:         { label: "Completed",         color: "#10b981" },
  cancelled:         { label: "Cancelled",         color: "#ef4444" },
  disputed:          { label: "Disputed",          color: "#ef4444" },
};

const PAYMENT_META = {
  pending:    { label: "Payment pending",    color: "#eab308" },
  authorised: { label: "Payment authorised", color: "#10b981" },
  captured:   { label: "Payment captured",   color: "#10b981" },
  refunded:   { label: "Refunded",           color: "#60a5fa" },
  failed:     { label: "Payment failed",     color: "#ef4444" },
};

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

function resolveUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${getApiBase()}${url}`;
}

function StatusPill({ label, color }) {
  return (
    <View style={[styles.pill, { borderColor: color + "55", backgroundColor: color + "22" }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function StarRating({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Text style={{ fontSize: 30, color: n <= value ? "#eab308" : COLORS.border }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionBox({ children }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, onPress, disabled, loading, variant = "default" }) {
  const bg = variant === "accent"
    ? COLORS.accent
    : variant === "danger"
    ? "#ef444422"
    : variant === "success"
    ? "#10b98122"
    : COLORS.alt;
  const border = variant === "accent"
    ? COLORS.accent
    : variant === "danger"
    ? "#ef444455"
    : variant === "success"
    ? "#10b98155"
    : COLORS.border;
  const textColor = variant === "accent"
    ? "#fff"
    : variant === "danger"
    ? "#ef4444"
    : variant === "success"
    ? "#10b981"
    : COLORS.textMuted;

  return (
    <Pressable
      style={[styles.actionBtn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 }]}
      onPress={onPress}
      disabled={disabled}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>}
    </Pressable>
  );
}

export default function OrderDetailSheet({ order, myUserId, visible, onClose, onRefresh }) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState("detail"); // "detail"|"cancel"|"dispute"|"feedback"|"success"
  const [cancelReason, setCancelReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackReview, setFeedbackReview] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [shipResult, setShipResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [shipOrder, { loading: shipLoading }] = useMutation(ShipOrderDocument);
  const [confirmReceived, { loading: confirmLoading }] = useMutation(ConfirmOrderReceivedDocument);
  const [raiseDispute, { loading: disputeLoading }] = useMutation(RaiseOrderDisputeDocument);
  const [cancelOrder, { loading: cancelLoading }] = useMutation(CancelOrderDocument);
  const [leaveFeedback, { loading: feedbackLoading }] = useMutation(LeaveOrderFeedbackDocument);

  function handleClose() {
    setPhase("detail");
    setCancelReason("");
    setDisputeReason("");
    setFeedbackRating(0);
    setFeedbackReview("");
    setSuccessMsg("");
    setErrorMsg("");
    setShipResult(null);
    onClose();
  }

  if (!order) return null;

  const isBuyer = order.buyerId === myUserId;
  const status = (order.fulfilmentStatus || "").toLowerCase();
  const payStatus = (order.paymentStatus || "").toLowerCase();
  const fulMeta = FULFILMENT_META[status] || { label: order.fulfilmentStatus, color: COLORS.textMuted };
  const payMeta = PAYMENT_META[payStatus] || { label: order.paymentStatus, color: COLORS.textMuted };

  const cardInfo = order.listing?.cardInfo;
  const counterparty = isBuyer ? order.seller : order.buyer;
  const orderNum = order.orderNumber || `#${order.id.slice(-6).toUpperCase()}`;

  const canShip    = !isBuyer && status === "awaiting_shipment" && !shipResult;
  const canConfirm = isBuyer  && status === "shipped";
  const canDispute = isBuyer  && status === "shipped";
  const canCancel  = !["completed", "cancelled", "disputed"].includes(status);
  const canFeedback = isBuyer && status === "completed";

  const hasTracking = order.trackingNumber || shipResult?.trackingNumber;

  async function handleShip() {
    setErrorMsg("");
    try {
      const { data } = await shipOrder({ variables: { id: order.id } });
      const res = data?.shipOrder;
      if (res?.ok) {
        setShipResult(res);
        setSuccessMsg("Shipping label generated and order marked as shipped.");
        onRefresh?.();
      } else {
        setErrorMsg("Shipping failed. Please try again.");
      }
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  async function handleConfirm() {
    setErrorMsg("");
    try {
      await confirmReceived({ variables: { id: order.id } });
      setSuccessMsg("Order confirmed as received.");
      onRefresh?.();
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  async function handleCancel() {
    setErrorMsg("");
    try {
      await cancelOrder({ variables: { id: order.id, reason: cancelReason || undefined } });
      setPhase("success");
      setSuccessMsg("Order cancelled.");
      onRefresh?.();
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  async function handleDispute() {
    if (!disputeReason.trim()) return;
    setErrorMsg("");
    try {
      await raiseDispute({ variables: { id: order.id, reason: disputeReason } });
      setPhase("success");
      setSuccessMsg("Dispute raised. Our team will review and contact both parties.");
      onRefresh?.();
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  async function handleFeedback() {
    if (feedbackRating < 1) return;
    setErrorMsg("");
    try {
      await leaveFeedback({
        variables: { id: order.id, rating: feedbackRating, review: feedbackReview || undefined },
      });
      setPhase("success");
      setSuccessMsg("Feedback submitted. Thanks!");
      onRefresh?.();
    } catch (e) {
      setErrorMsg(e.message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Order {orderNum}</Text>
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
              {cardInfo?.imageSmall ? (
                <Image source={{ uri: cardInfo.imageSmall }} style={styles.cardImage} resizeMode="contain" />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: COLORS.alt }]} />
              )}
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.cardName}>{cardInfo?.name || "Card"}</Text>
                {cardInfo?.setName && <Text style={styles.setName}>{cardInfo.setName}</Text>}
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  <StatusPill label={fulMeta.label} color={fulMeta.color} />
                  <StatusPill label={payMeta.label} color={payMeta.color} />
                </View>
              </View>
            </View>
          </SectionBox>

          {/* Price breakdown */}
          <SectionBox>
            <SectionTitle>Price breakdown</SectionTitle>
            <InfoRow label="Item" value={fmt(order.salePrice, order.currency)} />
            {Number(order.shippingCost) > 0 && (
              <InfoRow label="Shipping" value={fmt(order.shippingCost, order.currency)} />
            )}
            <View style={[styles.infoRow, styles.totalRow]}>
              <Text style={[styles.infoLabel, { color: COLORS.text, fontWeight: "800" }]}>Total</Text>
              <Text style={[styles.infoValue, { fontWeight: "800" }]}>{fmt(order.totalAmount, order.currency)}</Text>
            </View>
          </SectionBox>

          {/* Counterparty */}
          <SectionBox>
            <SectionTitle>{isBuyer ? "Seller" : "Buyer"}</SectionTitle>
            <Text style={styles.infoValue}>{counterparty?.username || "—"}</Text>
          </SectionBox>

          {/* Timeline */}
          <SectionBox>
            <SectionTitle>Timeline</SectionTitle>
            <InfoRow label="Ordered" value={fmtDate(order.createdAt)} />
            {order.shippedAt && <InfoRow label="Shipped" value={fmtDate(order.shippedAt)} />}
            {order.completedAt && <InfoRow label="Completed" value={fmtDate(order.completedAt)} />}
            {order.cancelledAt && <InfoRow label="Cancelled" value={fmtDate(order.cancelledAt)} />}
          </SectionBox>

          {/* Tracking */}
          {hasTracking && (
            <SectionBox>
              <SectionTitle>Tracking</SectionTitle>
              {(shipResult?.carrier || order.trackingCarrier) && (
                <InfoRow label="Carrier" value={shipResult?.carrier || order.trackingCarrier} />
              )}
              <InfoRow label="Tracking #" value={shipResult?.trackingNumber || order.trackingNumber} />
              {shipResult?.trackingUrl && (
                <ActionBtn
                  label="Track parcel →"
                  onPress={() => Linking.openURL(shipResult.trackingUrl)}
                />
              )}
              {shipResult?.labelUrl && (
                <ActionBtn
                  label="Download shipping label →"
                  onPress={() => Linking.openURL(resolveUrl(shipResult.labelUrl))}
                />
              )}
            </SectionBox>
          )}

          {/* ── Phase panels ── */}

          {/* Ship order (seller) */}
          {canShip && phase === "detail" && (
            <SectionBox>
              <SectionTitle>Ready to ship?</SectionTitle>
              <Text style={styles.hint}>
                This will generate a shipping label via Parcel2Go and mark the order as shipped.
              </Text>
              <ActionBtn
                label="Generate label & mark shipped"
                variant="accent"
                onPress={handleShip}
                loading={shipLoading}
                disabled={shipLoading}
              />
            </SectionBox>
          )}

          {/* Confirm received (buyer) */}
          {canConfirm && phase === "detail" && !successMsg && (
            <SectionBox>
              <SectionTitle>Received your order?</SectionTitle>
              <ActionBtn
                label="Confirm order received"
                variant="success"
                onPress={handleConfirm}
                loading={confirmLoading}
                disabled={confirmLoading}
              />
            </SectionBox>
          )}

          {/* Feedback prompt (buyer, completed) */}
          {canFeedback && phase === "detail" && !successMsg && (
            <SectionBox>
              <SectionTitle>Leave feedback</SectionTitle>
              <ActionBtn label="Rate this order" onPress={() => setPhase("feedback")} />
            </SectionBox>
          )}

          {/* Feedback panel */}
          {phase === "feedback" && (
            <SectionBox>
              <SectionTitle>Rate this order</SectionTitle>
              <Text style={styles.hint}>How was your experience with this seller?</Text>
              <StarRating value={feedbackRating} onChange={setFeedbackRating} />
              <TextInput
                style={styles.textArea}
                placeholder="Leave a review (optional)…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={feedbackReview}
                onChangeText={setFeedbackReview}
              />
              <View style={styles.btnRow}>
                <View style={{ flex: 1 }}>
                  <ActionBtn label="Back" onPress={() => setPhase("detail")} />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionBtn
                    label="Submit"
                    variant="accent"
                    onPress={handleFeedback}
                    loading={feedbackLoading}
                    disabled={feedbackLoading || feedbackRating < 1}
                  />
                </View>
              </View>
            </SectionBox>
          )}

          {/* Dispute panel */}
          {phase === "dispute" && (
            <SectionBox>
              <SectionTitle>Raise a dispute</SectionTitle>
              <Text style={styles.hint}>
                Describe the issue. Our team will review and contact both parties.
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the problem…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={4}
                value={disputeReason}
                onChangeText={setDisputeReason}
              />
              <View style={styles.btnRow}>
                <View style={{ flex: 1 }}>
                  <ActionBtn label="Back" onPress={() => setPhase("detail")} />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionBtn
                    label="Raise dispute"
                    variant="danger"
                    onPress={handleDispute}
                    loading={disputeLoading}
                    disabled={disputeLoading || !disputeReason.trim()}
                  />
                </View>
              </View>
            </SectionBox>
          )}

          {/* Cancel panel */}
          {phase === "cancel" && (
            <SectionBox>
              <SectionTitle>Cancel order</SectionTitle>
              <Text style={styles.hint}>
                Cancelling will release any payment authorisation. This cannot be undone.
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Reason for cancellation (optional)…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={cancelReason}
                onChangeText={setCancelReason}
              />
              <View style={styles.btnRow}>
                <View style={{ flex: 1 }}>
                  <ActionBtn label="Back" onPress={() => setPhase("detail")} />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionBtn
                    label="Confirm cancel"
                    variant="danger"
                    onPress={handleCancel}
                    loading={cancelLoading}
                    disabled={cancelLoading}
                  />
                </View>
              </View>
            </SectionBox>
          )}

          {/* Bottom action row (detail phase only) */}
          {phase === "detail" && (canDispute || canCancel) && (
            <View style={styles.btnRow}>
              {canDispute && (
                <View style={{ flex: 1 }}>
                  <ActionBtn label="Raise dispute" variant="danger" onPress={() => setPhase("dispute")} />
                </View>
              )}
              {canCancel && (
                <View style={{ flex: 1 }}>
                  <ActionBtn label="Cancel order" onPress={() => setPhase("cancel")} />
                </View>
              )}
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
  totalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  hint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  textArea: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    color: COLORS.text,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: "top",
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: { fontWeight: "700", fontSize: 13 },
  btnRow: { flexDirection: "row", gap: 8 },
});
