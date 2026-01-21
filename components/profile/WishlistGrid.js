// components/profile/WishlistGrid.js
//
// UPDATED (2026-01-19):
// - FIX: Guarantees 2 columns using FlatList numColumns={2}
// - FIX: Status badge renders from c._wishlist.status (must be provided by WishlistTab normalizer)
// - Keeps: long-press status picker modal + optimistic UI overrides
// - Uses columnWrapperStyle for reliable spacing (no flexWrap rounding issues)

import EmptyState from "../../components/common/EmptyState";
import { COLORS } from "../../theme/colors";

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { normalizeImageUrl } from "../../utils/cards";

/* -------------------- helpers -------------------- */

const STATUS_OPTIONS = [
  "HUNTING",
  "WANT",
  "MAYBE",
  "OWNED",
  "TRADED",
  "DROPPED",
];

function normalizeStatus(value) {
  if (!value) return "";
  return String(value).trim().toUpperCase();
}

function makeKey(cardId, variation) {
  return `${String(cardId || "")}::${String(variation || "normal")}`;
}

function prettyStatus(status) {
  const s = normalizeStatus(status);
  return s || "";
}

/* -------------------- component -------------------- */

export default function WishlistGrid({
  items,
  onOpenCard,
  onBrowse,

  // optional
  onUpdateWishlistEntry,
  showStatusBadges = true,
  enableQuickStatus = true,
}) {
  // Optimistic status overrides
  const [statusOverride, setStatusOverride] = useState(() => new Map());

  // Modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItem, setPickerItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const canQuickEdit =
    enableQuickStatus && typeof onUpdateWishlistEntry === "function";

  const openPickerFor = useCallback(
    (card) => {
      if (!canQuickEdit) return;
      setPickerItem(card);
      setPickerOpen(true);
    },
    [canQuickEdit],
  );

  const closePicker = useCallback(() => {
    if (saving) return;
    setPickerOpen(false);
    setPickerItem(null);
  }, [saving]);

  const currentStatus = useMemo(() => {
    if (!pickerItem) return "";
    const cardId = pickerItem?._wishlist?.cardId || pickerItem?.id;
    const variation = pickerItem?._wishlist?.variation || "normal";
    const key = makeKey(cardId, variation);

    const override = statusOverride.get(key);
    if (override) return normalizeStatus(override);

    return normalizeStatus(pickerItem?._wishlist?.status);
  }, [pickerItem, statusOverride]);

  const setStatusForPickerItem = useCallback(
    async (nextStatus) => {
      if (!pickerItem || !canQuickEdit) return;

      const cardId = pickerItem?._wishlist?.cardId || pickerItem?.id;
      const variation = pickerItem?._wishlist?.variation || "normal";
      const key = makeKey(cardId, variation);

      const prev =
        statusOverride.get(key) ||
        normalizeStatus(pickerItem?._wishlist?.status);

      // Optimistic UI update
      setStatusOverride((prevMap) => {
        const next = new Map(prevMap);
        const v = normalizeStatus(nextStatus);
        if (v) next.set(key, v);
        else next.delete(key);
        return next;
      });

      setSaving(true);

      try {
        const res = await onUpdateWishlistEntry({
          cardId: String(cardId),
          variation: variation || null,
          status: nextStatus, // enum or null
        });

        const ok = res?.ok !== false;
        if (!ok) {
          // rollback
          setStatusOverride((prevMap) => {
            const next = new Map(prevMap);
            if (prev) next.set(key, normalizeStatus(prev));
            else next.delete(key);
            return next;
          });
        }
      } catch (err) {
        // rollback
        setStatusOverride((prevMap) => {
          const next = new Map(prevMap);
          if (prev) next.set(key, normalizeStatus(prev));
          else next.delete(key);
          return next;
        });
      } finally {
        setSaving(false);
        closePicker();
      }
    },
    [
      pickerItem,
      canQuickEdit,
      onUpdateWishlistEntry,
      statusOverride,
      closePicker,
    ],
  );

  const renderTile = useCallback(
    ({ item: c, index }) => {
      const img = normalizeImageUrl(c.image);

      const cardId = c?._wishlist?.cardId || c?.id;
      const variation = c?._wishlist?.variation || "normal";
      const key = makeKey(cardId, variation);

      const status =
        normalizeStatus(statusOverride.get(key)) ||
        normalizeStatus(c?._wishlist?.status);

      const quantity =
        typeof c?._wishlist?.quantity === "number"
          ? c._wishlist.quantity
          : null;

      return (
        <Pressable
          onPress={() => onOpenCard?.(c)}
          onLongPress={() => openPickerFor(c)}
          delayLongPress={250}
          style={[
            styles.wishlistTile,
            // add top spacing after first row (index >= 2 because 2 columns)
            index >= 2 && { marginTop: 8 },
          ]}
        >
          <View style={styles.wishlistImgWrap}>
            {img ? (
              <Image
                source={{ uri: img }}
                resizeMode="contain"
                style={StyleSheet.absoluteFill}
              />
            ) : null}

            {/* Status badge */}
            {showStatusBadges && !!status && (
              <View style={styles.badgeWrap}>
                <Text style={styles.badgeText}>{prettyStatus(status)}</Text>
              </View>
            )}

            {/* Quantity badge */}
            {showStatusBadges && quantity != null && quantity > 1 && (
              <View style={styles.qtyBadgeWrap}>
                <Text style={styles.qtyBadgeText}>x{quantity}</Text>
              </View>
            )}
          </View>

          <Text style={styles.tileName} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.tileMeta} numberOfLines={1}>
            {c.setName} · #{c.number}
          </Text>

          {canQuickEdit && (
            <Text style={styles.quickHint} numberOfLines={1}>
              Long-press to set status
            </Text>
          )}
        </Pressable>
      );
    },
    [onOpenCard, openPickerFor, statusOverride, showStatusBadges, canQuickEdit],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Wishlist</Text>

      {items?.length ? (
        <FlatList
          data={items}
          keyExtractor={(c) =>
            makeKey(
              c?._wishlist?.cardId || c?.id,
              c?._wishlist?.variation || "normal",
            )
          }
          numColumns={2}
          renderItem={renderTile}
          contentContainerStyle={{ paddingTop: 10 }}
          columnWrapperStyle={{ gap: 8 }}
          scrollEnabled={false} // IMPORTANT: this sits inside profile scroll
        />
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState message="Your wishlist is empty." />
          <Pressable
            onPress={onBrowse}
            style={[styles.ctaSmall, { backgroundColor: COLORS.accent }]}
          >
            <Text style={styles.ctaSmallText}>Browse cards</Text>
          </Pressable>
        </View>
      )}

      {/* Status picker modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Set wishlist status</Text>

            {!!pickerItem && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {pickerItem?.name}{" "}
                <Text style={{ opacity: 0.75 }}>
                  · {pickerItem?.setName} · #{pickerItem?.number}
                </Text>
              </Text>
            )}

            <View style={styles.modalOptions}>
              <Option
                label="CLEAR"
                active={!currentStatus}
                disabled={saving}
                onPress={() => setStatusForPickerItem(null)}
              />
              {STATUS_OPTIONS.map((s) => (
                <Option
                  key={s}
                  label={s}
                  active={normalizeStatus(currentStatus) === s}
                  disabled={saving}
                  onPress={() => setStatusForPickerItem(s)}
                />
              ))}
            </View>

            <View style={styles.modalFooter}>
              {saving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color={COLORS.accent} />
                  <Text style={styles.savingText}>Saving…</Text>
                </View>
              ) : (
                <Pressable onPress={closePicker} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* -------------------- option -------------------- */

function Option({ label, active, disabled, onPress }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        active ? styles.optionActive : styles.optionIdle,
        disabled && { opacity: 0.6 },
      ]}
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

/* -------------------- styles -------------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },

  wishlistTile: {
    flex: 1, // IMPORTANT: lets FlatList distribute evenly across 2 columns
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8,
  },
  wishlistImgWrap: {
    backgroundColor: COLORS.surface,
    aspectRatio: 245 / 337,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
    position: "relative",
  },
  tileName: { color: COLORS.text, fontWeight: "700" },
  tileMeta: { color: COLORS.textMuted, fontSize: 12 },
  quickHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },

  emptyWrap: { alignItems: "center", gap: 8, marginTop: 10 },
  ctaSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  ctaSmallText: { color: "#fff", fontWeight: "800" },

  badgeWrap: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  qtyBadgeWrap: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  qtyBadgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 16,
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  modalTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  modalSubtitle: { color: COLORS.textMuted, marginTop: 6, fontWeight: "700" },

  modalOptions: { marginTop: 12, gap: 8 },

  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionIdle: { borderColor: COLORS.border, backgroundColor: COLORS.alt },
  optionActive: { borderColor: COLORS.accent, backgroundColor: COLORS.alt },
  optionText: { fontWeight: "900" },
  optionTextIdle: { color: COLORS.text },
  optionTextActive: { color: COLORS.accent },

  modalFooter: { marginTop: 14, alignItems: "flex-end" },
  modalCloseBtn: {
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
