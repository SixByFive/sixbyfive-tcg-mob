// components/market/EditListingSheet.js
//
// Edit an existing listing: price, quantity, status.
// Opened from the "Edit" button on MyListingRow.

import React, { useEffect, useState } from "react";
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
import CardImage from "../common/CardImage";
import {
  UpdateListingDocument,
  MyMarketListingsDocument,
} from "../../graphql/documents";

const STATUS_OPTIONS = [
  { value: "ACTIVE",    label: "Active",    color: "#10b981" },
  { value: "SUSPENDED", label: "Paused",    color: "#6b7280" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(price) {
  const n = Number(price);
  return isNaN(n) ? "" : n.toFixed(2);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EditListingSheet({ visible, listing, onClose, onSaved }) {
  const insets = useSafeAreaInsets();

  const [price,    setPrice]    = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status,   setStatus]   = useState("ACTIVE");
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const [updateListing] = useMutation(UpdateListingDocument, {
    refetchQueries: [{ query: MyMarketListingsDocument, variables: { limit: 40 } }],
  });

  // Seed form when listing changes
  useEffect(() => {
    if (listing) {
      setPrice(listing.price != null ? fmt(listing.price) : "");
      setQuantity(String(listing.quantity ?? 1));
      setStatus(listing.status ?? "ACTIVE");
      setError("");
    }
  }, [listing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setError("");
    onClose();
  }

  async function handleSave() {
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Enter a valid price.");
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await updateListing({
        variables: {
          id: listing.id,
          input: {
            price: priceNum,
            quantity: qtyNum,
            status,
          },
        },
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  const cardName = listing?.cardInfo?.name ?? listing?.cardId ?? "Card";
  const cardImg  = listing?.cardInfo?.imageSmall ?? null;
  const setName  = listing?.cardInfo?.setName ?? "";
  const condition = listing?.condition ?? "";

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
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={styles.navText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Edit listing</Text>
            <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
              {saving
                ? <ActivityIndicator color={COLORS.accent} size="small" />
                : <Text style={[styles.navText, { color: COLORS.accent, fontWeight: "900" }]}>Save</Text>
              }
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Error ───────────────────────────────────────────────── */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Card summary ────────────────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.cardRow}>
                <CardImage uri={cardImg} name={cardName} cardId={listing?.cardId} style={styles.thumb} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.cardName} numberOfLines={2}>{cardName}</Text>
                  {setName ? <Text style={styles.cardMeta}>{setName}</Text> : null}
                  {condition ? <Text style={styles.cardMeta}>{condition}</Text> : null}
                </View>
              </View>
            </View>

            {/* ── Price ───────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Price</Text>
              <View style={styles.priceRow}>
                <Text style={styles.poundSign}>£</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={(v) => {
                    // Allow digits and one decimal point
                    const cleaned = v.replace(/[^0-9.]/g, "");
                    const parts = cleaned.split(".");
                    if (parts.length > 2) return;
                    if (parts[1]?.length > 2) return;
                    setPrice(cleaned);
                    setError("");
                  }}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* ── Quantity ────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Quantity</Text>
              <View style={styles.qtyRow}>
                <Pressable
                  onPress={() => setQuantity((q) => String(Math.max(1, parseInt(q || "1", 10) - 1)))}
                  style={styles.qtyBtn}
                  hitSlop={6}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <TextInput
                  style={styles.qtyInput}
                  value={quantity}
                  onChangeText={(v) => {
                    const n = v.replace(/\D/g, "");
                    setQuantity(n);
                    setError("");
                  }}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <Pressable
                  onPress={() => setQuantity((q) => String(parseInt(q || "1", 10) + 1))}
                  style={styles.qtyBtn}
                  hitSlop={6}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* ── Status ──────────────────────────────────────────────── */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Status</Text>
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => setStatus(opt.value)}
                    style={[
                      styles.statusChip,
                      status === opt.value && { borderColor: opt.color, backgroundColor: opt.color + "18" },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                    <Text
                      style={[
                        styles.statusChipText,
                        status === opt.value && { color: opt.color, fontWeight: "800" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.statusHint}>
                {status === "SUSPENDED"
                  ? "Listing hidden from browse — buyers won't see it until you set it back to Active."
                  : "Listing is visible to buyers in the marketplace."}
              </Text>
            </View>

            {/* ── Save button (also at bottom for thumb reach) ────────── */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save changes</Text>
              }
            </Pressable>

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
  navText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 15, minWidth: 52 },

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
    gap: 10,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // card summary
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 52, height: 71, borderRadius: 6 },
  thumbFallback: { backgroundColor: COLORS.alt },
  cardName: { color: COLORS.text, fontWeight: "700", fontSize: 15, lineHeight: 20 },
  cardMeta: { color: COLORS.textMuted, fontSize: 12 },

  // price
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  poundSign: { color: COLORS.text, fontSize: 20, fontWeight: "700", marginRight: 4 },
  priceInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    paddingVertical: 12,
  },

  // quantity
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { color: COLORS.text, fontSize: 22, fontWeight: "700", lineHeight: 26 },
  qtyInput: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  // status
  statusRow: { flexDirection: "row", gap: 10 },
  statusChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.alt,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { color: COLORS.textMuted, fontWeight: "700", fontSize: 14 },
  statusHint: { color: COLORS.textMuted, fontSize: 11, lineHeight: 15 },

  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
