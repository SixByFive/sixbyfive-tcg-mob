// components/collection/WishlistCardTile.js
//
// UPDATED (2026-01-20):
// - RESTORED: Status picker modal (long-press to open)
// - RESTORED: "Long press to edit" note (subtle hint pill)
// - CHANGED: Removed "tap to cycle" completely (status pill is NOT tappable now)
// - KEEP: Price UI matches CollectionCardTile exactly (PricePillInline + helpers copied)
// - KEEP: Always 2-column sizing (even when only 1 item) via flexBasis/maxWidth 50%
// - KEEP: Variation pill + icon-only actions
//
// UX:
// - Long-press anywhere on the card image area opens modal
// - Status pill is display-only (no onPress)
// - Hint pill: "Long press to edit" (only shows when canEditStatus)

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import { normalizeImageUrl } from "../../utils/cards";

/* =================== Price helpers (COPIED from CollectionCardTile) =================== */

// Normalize a single row into a consistent shape.
function normalizePriceRow(p) {
  if (!p || typeof p !== "object") return null;
  const provider =
    (p.provider ?? p.source ?? "").toString().toLowerCase() || null;
  const variant =
    (p.variant ?? p.variation ?? "").toString().toLowerCase() || null;

  // Prefer pre-converted GBP if present; otherwise keep mid/market.
  const gbp = Number.isFinite(p?.gbp) ? Number(p.gbp) : null;
  const mid = Number.isFinite(p?.mid)
    ? Number(p.mid)
    : Number.isFinite(p?.market)
      ? Number(p.market)
      : null;

  const low = Number.isFinite(p?.low) ? Number(p.low) : null;
  const high = Number.isFinite(p?.high) ? Number(p.high) : null;
  const currency = p?.currency ?? (gbp != null ? "GBP" : null);
  const updatedAt = p?.updatedAt ?? p?.lastUpdated ?? null;

  return {
    provider,
    variant,
    gbp,
    mid,
    low,
    high,
    currency,
    updatedAt,
    _raw: p,
  };
}

// Fold shapes into an array we can evaluate.
function collectPriceRows(item) {
  const rows = [];
  const a = Array.isArray(item?.prices) ? item.prices : null;
  const b = Array.isArray(item?.pricing) ? item.pricing : null;
  const c =
    item?.priceLatest && !Array.isArray(item.priceLatest)
      ? [item.priceLatest]
      : null;

  if (a) rows.push(...a);
  if (b) rows.push(...b);
  if (c) rows.push(...c);

  return rows.map(normalizePriceRow).filter(Boolean);
}

// Pick a single best overall row:
// 1) Prefer rows that have GBP
// 2) Among those, prefer the most recently updated (by updatedAt)
// 3) Else, take the first available row
function pickBestOverall(rows) {
  if (!rows?.length) return null;
  const gbpRows = rows.filter((r) => typeof r.gbp === "number");
  const list = gbpRows.length ? gbpRows : rows;

  const dated = list.filter((r) => !!r.updatedAt);
  if (dated.length) {
    dated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return dated[0];
  }
  return list[0];
}

/* =================== Price UI (COPIED from CollectionCardTile) =================== */

function formatMoneyGBP(value) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `£${Number(value).toFixed(2)}`;
  }
}

// Short “time ago” for inline display: just now / 12m / 3h / 2d
function timeAgoShort(dt) {
  const ts = +new Date(dt);
  if (!isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Single-line inline pill with value + updated time. */
function PricePillInline({ priceRow }) {
  if (!priceRow) {
    return (
      <View style={styles.pricePlaceholder}>
        <Text style={styles.pricePlaceholderText}>No price yet</Text>
      </View>
    );
  }

  const value = typeof priceRow.gbp === "number" ? priceRow.gbp : priceRow.mid;
  if (!Number.isFinite(value)) {
    return (
      <View style={styles.pricePlaceholder}>
        <Text style={styles.pricePlaceholderText}>No price yet</Text>
      </View>
    );
  }

  const updated = priceRow.updatedAt ? timeAgoShort(priceRow.updatedAt) : null;

  return (
    <View
      style={styles.pricePill}
      accessibilityRole="text"
      accessibilityLabel={`Estimated price ${formatMoneyGBP(value)}${
        updated ? `, updated ${updated} ago` : ""
      }`}
    >
      <Text style={styles.priceValue}>{formatMoneyGBP(value)}</Text>
      {updated ? <Text style={styles.priceDot}>•</Text> : null}
      {updated ? (
        <View style={styles.timeWrap}>
          <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.timeText}>{updated}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* =================== Wishlist status helpers =================== */

const STATUS_OPTIONS = ["ACTIVE", "GRAIL", "EVENTUAL", "UPGRADE"];

function prettyStatus(s) {
  switch (String(s || "").toUpperCase()) {
    case "ACTIVE":
      return "Hunting";
    case "GRAIL":
      return "Dream";
    case "EVENTUAL":
      return "Someday";
    case "UPGRADE":
      return "Upgrade";
    default:
      return "";
  }
}

function statusTone(status) {
  const s = String(status || "").toUpperCase();
  // keep it consistent with your theme (no random bright colors)
  if (s === "GRAIL")
    return { bg: COLORS.alt, border: COLORS.accent, text: COLORS.text };
  if (s === "ACTIVE")
    return { bg: COLORS.background, border: COLORS.border, text: COLORS.text };
  if (s === "EVENTUAL")
    return {
      bg: COLORS.background,
      border: COLORS.border,
      text: COLORS.textMuted,
    };
  if (s === "UPGRADE")
    return { bg: COLORS.background, border: COLORS.border, text: COLORS.text };
  return {
    bg: COLORS.background,
    border: COLORS.border,
    text: COLORS.textMuted,
  };
}

/* =================== Component =================== */

export default function WishlistCardTile({
  item = {}, // { id, name, setName, number, image, prices/pricing/priceLatest, _wishlist? }
  onView,
  onMoveToCollection,
  onRemoveFromWishlist,
  onUpdateWishlistEntry, // ({ cardId, variation, status, quantity, notes }) => Promise
}) {
  const imageUri = normalizeImageUrl(item?.image);
  const variation = String(item?._wishlist?.variation ?? "normal");
  const status = String(item?._wishlist?.status ?? "").toUpperCase();
  const statusLabel = prettyStatus(status);

  const canEditStatus =
    typeof onUpdateWishlistEntry === "function" &&
    !!String(item?.id ?? item?._wishlist?.cardId ?? "").trim();

  // Compute best price once, same algorithm as CollectionCardTile.
  const bestPriceRow = useMemo(() => {
    const rows = collectPriceRows(item);
    return pickBestOverall(rows);
  }, [item]);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const openStatusModal = useCallback(() => {
    if (!canEditStatus) return;
    setStatusModalOpen(true);
  }, [canEditStatus]);

  const closeStatusModal = useCallback(() => {
    if (savingStatus) return;
    setStatusModalOpen(false);
  }, [savingStatus]);

  const callUpdate = useCallback(
    async (next) => {
      if (!canEditStatus) return;

      const cardId = String(item?.id ?? item?._wishlist?.cardId ?? "").trim();
      if (!cardId) return;

      // IMPORTANT: never send null qty (prevents your notNull violation)
      const qty =
        typeof item?._wishlist?.quantity === "number" &&
        Number.isFinite(item._wishlist.quantity) &&
        item._wishlist.quantity > 0
          ? Math.round(item._wishlist.quantity)
          : 1;

      const notes =
        typeof item?._wishlist?.notes === "string" ? item._wishlist.notes : "";

      setSavingStatus(true);
      try {
        await onUpdateWishlistEntry({
          cardId,
          variation,
          status: next || null,
          quantity: qty,
          notes,
        });
      } finally {
        setSavingStatus(false);
      }
    },
    [canEditStatus, item, onUpdateWishlistEntry, variation],
  );

  const tone = statusTone(status);

  return (
    // FIX: ensures 2 columns always (even with 1 item)
    <View style={styles.cardOuter}>
      <View style={styles.card}>
        {/* Long press should be on the main pressable (NOT the status pill). */}
        <Pressable
          onPress={onView}
          onLongPress={openStatusModal}
          delayLongPress={250}
          android_ripple={{ color: "#00000022" }}
        >
          <View style={styles.cardImageWrap}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.cardImage}
                resizeMode="contain"
              />
            ) : null}

            {/* Status pill (display-only) */}
            {statusLabel ? (
              <View
                pointerEvents="none" // CHANGED: prevents tap/cycle
                style={[
                  styles.statusPill,
                  { backgroundColor: tone.bg, borderColor: tone.border },
                ]}
              >
                <Ionicons
                  name="bookmark"
                  size={12}
                  color={tone.text}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.statusText, { color: tone.text }]}>
                  {statusLabel}
                </Text>
              </View>
            ) : null}

            {/* Variation pill (top-right) */}
            <View style={styles.variationPill} pointerEvents="none">
              <Text style={styles.variationText}>
                {variationLabel(variation)}
              </Text>
            </View>

            {/* Hint pill (bottom-left) */}
            {canEditStatus ? (
              <View style={styles.hintPill} pointerEvents="none">
                <Ionicons
                  name="hand-left-outline"
                  size={12}
                  color={COLORS.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.hintText}>Long press to edit</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item?.name || "—"}
            </Text>

            <View style={styles.rowBetween}>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item?.setName || "—"}
              </Text>
              <Text style={styles.cardMetaStrong}>#{item?.number ?? "—"}</Text>
            </View>

            {/* Price pill (matches CollectionCardTile) */}
            <View style={{ marginTop: 8 }}>
              <PricePillInline priceRow={bestPriceRow} />
            </View>
          </View>
        </Pressable>

        {/* Actions (icon-only) */}
        <View style={styles.actionBar}>
          <IconButton
            icon="download-outline"
            variant="filled"
            onPress={onMoveToCollection}
            accessibilityLabel="Move to collection"
          />
          <IconButton
            icon="trash-outline"
            variant="tinted"
            onPress={onRemoveFromWishlist}
            accessibilityLabel="Remove from wishlist"
          />
        </View>

        {/* Status picker modal (RESTORED) */}
        <Modal
          visible={statusModalOpen}
          transparent
          animationType="fade"
          onRequestClose={closeStatusModal}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeStatusModal}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Set wishlist status</Text>
              <Text style={styles.modalSub}>
                Choose one option below. (Long press a card to open this.)
              </Text>

              <View style={{ height: 10 }} />

              {/* 2-column grid like you had before */}
              <View style={styles.modalGrid}>
                {/* <View style={styles.modalCell}>
                  <OptionButton
                    label="Clear"
                    active={!statusLabel}
                    disabled={savingStatus}
                    onPress={async () => {
                      await callUpdate("");
                      closeStatusModal();
                    }}
                  />
                </View> */}

                {STATUS_OPTIONS.map((s) => (
                  <View key={s} style={styles.modalCell}>
                    <OptionButton
                      label={prettyStatus(s)}
                      active={String(status || "").toUpperCase() === s}
                      disabled={savingStatus}
                      onPress={async () => {
                        await callUpdate(s);
                        closeStatusModal();
                      }}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.modalFooter}>
                {savingStatus ? (
                  <View style={styles.savingRow}>
                    <Ionicons
                      name="sync-outline"
                      size={16}
                      color={COLORS.accent}
                    />
                    <Text style={styles.savingText}>Saving…</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={closeStatusModal}
                    style={styles.modalClose}
                  >
                    <Text style={styles.modalCloseText}>Close</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
}

/* ---------------- helpers ---------------- */

function variationLabel(v) {
  const k = String(v || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (
    k === "reverse" ||
    k === "reverseholo" ||
    k === "reverseholofoil" ||
    k === "rev"
  )
    return "Reverse";
  if (k === "holo" || k === "holofoil" || k === "foil") return "Holo";
  if (k === "normal" || k === "nonholo" || k === "nonfoil") return "Normal";
  return v || "Normal";
}

/* ---------------- Icon-only button ---------------- */

function IconButton({
  icon,
  variant = "default",
  onPress,
  accessibilityLabel,
}) {
  const base = [
    styles.iconBtn,
    variant === "filled" && styles.iconBtnFilled,
    variant === "tinted" && styles.iconBtnTint,
  ];
  const iconColor =
    variant === "filled"
      ? "#fff"
      : variant === "tinted"
        ? COLORS.accent
        : COLORS.text;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "#00000022", borderless: false }}
      style={({ pressed }) => [base, pressed && styles.iconBtnPressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
    </Pressable>
  );
}

function OptionButton({ label, active, disabled, onPress }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.optionBtn,
        active ? styles.optionActive : styles.optionIdle,
        disabled && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Set status to ${label}`}
    >
      <Text
        style={[
          styles.optionText,
          active ? styles.optionTextActive : styles.optionTextIdle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  // FIX: Always 2 columns (even with 1 item)
  cardOuter: {
    flexBasis: "50%",
    maxWidth: "50%",
  },

  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    margin: 6,
    overflow: "hidden",
  },
  cardImageWrap: {
    backgroundColor: COLORS.alt,
    aspectRatio: 245 / 337,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardImage: { ...StyleSheet.absoluteFillObject },

  // Status pill (top-left) - display only
  statusPill: {
    position: "absolute",
    left: 8,
    top: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statusText: { fontWeight: "900", fontSize: 11 },

  // Variation pill (top-right)
  variationPill: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "#0e1119",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  variationText: { color: COLORS.text, fontWeight: "800", fontSize: 11 },

  // Hint pill (bottom-left)
  hintPill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  hintText: { color: COLORS.textMuted, fontWeight: "800", fontSize: 11 },

  cardInfo: { padding: 8 },
  cardName: { color: COLORS.text, fontSize: 14.5, fontWeight: "700" },
  rowBetween: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    flexShrink: 1,
    marginRight: 8,
  },
  cardMetaStrong: { color: COLORS.text, fontSize: 12, fontWeight: "700" },

  /* ---- Price pill (COPIED styles) ---- */
  pricePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  priceValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  priceDot: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900" },
  timeWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800" },
  pricePlaceholder: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pricePlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  /* Actions */
  actionBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  iconBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconBtnFilled: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  iconBtnTint: { backgroundColor: COLORS.alt, borderColor: COLORS.accent },
  iconBtnPressed: { transform: [{ scale: 0.98 }] },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  modalSub: { color: COLORS.textMuted, marginTop: 4, fontSize: 12 },

  // 2-column grid
  modalGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  modalCell: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },

  optionBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
  },
  optionIdle: { borderColor: COLORS.border, backgroundColor: COLORS.alt },
  optionActive: { borderColor: COLORS.accent, backgroundColor: COLORS.alt },
  optionText: { fontWeight: "900" },
  optionTextIdle: { color: COLORS.text },
  optionTextActive: { color: COLORS.accent },

  modalFooter: { marginTop: 6, alignItems: "flex-end" },
  modalClose: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCloseText: { color: COLORS.text, fontWeight: "900" },

  savingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  savingText: { color: COLORS.text, fontWeight: "900" },
});
