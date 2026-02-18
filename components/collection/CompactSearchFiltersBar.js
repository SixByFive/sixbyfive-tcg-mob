// components/collection/CompactSearchFiltersBar.js
//
// UPDATED (2026-01-21):
// - CHANGE: Removed redundant second button (sort button) that opened the same modal
// - CHANGE: Combined sort + filter into a single "Controls" pill button
// - ADD: Shows current sort label inline (e.g. "Sort: Name") in collapsed bar (when sort exists)
// - KEEP: Active filter count badge behavior (accent tone when filters active)

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { COLORS } from "../../theme/colors";

function PillButton({ icon, label, onPress, tone = "default" }) {
  const bg = tone === "accent" ? COLORS.accent : COLORS.background;
  const border = tone === "accent" ? COLORS.accent : COLORS.border;
  const textColor = tone === "accent" ? "#fff" : COLORS.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillBtn,
        { backgroundColor: bg, borderColor: border },
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
      android_ripple={{ color: "#00000022" }}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color={textColor} />
      {label ? (
        <Text style={[styles.pillBtnText, { color: textColor }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipIdle,
        pressed && { opacity: 0.9 },
      ]}
      android_ripple={{ color: "#00000022" }}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextIdle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CompactSearchFiltersBar({
  query,
  onChangeQuery,
  activeFilterCount = 0,

  sortKey,
  sortOptions = [], // [{ key, label }]
  onChangeSort,

  // [{ key, title, options:[{key,label}], value:[...], onChange(nextArr) }]
  filterGroups = [],

  onClearAll,
}) {
  const [open, setOpen] = useState(false);

  const hasSort = Array.isArray(sortOptions) && sortOptions.length > 0;
  const sortLabel = useMemo(() => {
    if (!hasSort) return null;
    return sortOptions.find((o) => o.key === sortKey)?.label ?? "Sort";
  }, [hasSort, sortOptions, sortKey]);

  // NEW: A compact inline label so removing the second button doesn't hide sort state.
  const inlineSortLabel = useMemo(() => {
    if (!hasSort) return null;
    const label = sortLabel ?? "Sort";
    // Keep it short for ultra-compact row
    return `Sort: ${label}`;
  }, [hasSort, sortLabel]);

  return (
    <>
      {/* Collapsed compact row */}
      <View style={styles.bar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {!!query ? (
            <Pressable
              onPress={() => onChangeQuery?.("")}
              hitSlop={10}
              style={{ paddingLeft: 6 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={COLORS.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {/* NEW: Optional inline sort label (instead of a second "sort" button) */}
        {inlineSortLabel ? (
          <View style={styles.sortPill}>
            <Ionicons
              name="swap-vertical-outline"
              size={14}
              color={COLORS.textMuted}
            />
            <Text style={styles.sortPillText} numberOfLines={1}>
              {inlineSortLabel}
            </Text>
          </View>
        ) : null}

        {/* CHANGE: Single combined button opens the bottom sheet */}
        <PillButton
          icon="options-outline"
          // If you want the number shown as a badge-like label, keep it here:
          label={activeFilterCount > 0 ? String(activeFilterCount) : ""}
          onPress={() => setOpen(true)}
          tone={activeFilterCount > 0 ? "accent" : "default"}
        />

        {/* REMOVED:
            {hasSort ? (
              <PillButton
                icon="swap-vertical-outline"
                label={""}
                onPress={() => setOpen(true)}
              />
            ) : null}
        */}
      </View>

      {/* Bottom sheet modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filters</Text>

              <View style={{ flexDirection: "row", gap: 8 }}>
                {typeof onClearAll === "function" ? (
                  <Pressable
                    onPress={onClearAll}
                    style={({ pressed }) => [
                      styles.headerBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.headerBtnText}>Clear</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={() => setOpen(false)}
                  style={({ pressed }) => [
                    styles.headerBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.headerBtnText}>Done</Text>
                </Pressable>
              </View>
            </View>

            {hasSort ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.groupTitle}>Sort</Text>
                <View style={styles.chipsRow}>
                  {sortOptions.map((o) => (
                    <Chip
                      key={o.key}
                      label={o.label}
                      active={o.key === sortKey}
                      onPress={() => onChangeSort?.(o.key)}
                    />
                  ))}
                </View>
                {sortLabel ? (
                  <Text style={styles.helperText}>Current: {sortLabel}</Text>
                ) : null}
              </View>
            ) : null}

            <ScrollView
              style={{ marginTop: 12 }}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {filterGroups.map((g) => (
                <View key={g.key} style={{ marginBottom: 14 }}>
                  <Text style={styles.groupTitle}>{g.title}</Text>
                  <View style={styles.chipsRow}>
                    {(g.options || []).map((opt) => {
                      const active = Array.isArray(g.value)
                        ? g.value.includes(opt.key)
                        : false;

                      return (
                        <Chip
                          key={opt.key}
                          label={opt.label}
                          active={active}
                          onPress={() => {
                            const cur = Array.isArray(g.value) ? g.value : [];
                            const next = active
                              ? cur.filter((x) => x !== opt.key)
                              : [...cur, opt.key];
                            g.onChange?.(next);
                          }}
                        />
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginTop: 8,
    marginBottom: 12,
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 0,
  },

  sortPill: {
    height: 40,
    maxWidth: 140, // keeps bar compact
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortPillText: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 12,
  },

  pillBtn: {
    height: 40,
    minWidth: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pillBtnText: { fontWeight: "900", fontSize: 13 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    padding: 14,
    maxHeight: "78%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  headerBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtnText: { color: COLORS.text, fontWeight: "900" },

  groupTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  helperText: {
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: "700",
    fontSize: 12,
  },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipIdle: { backgroundColor: COLORS.alt, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.alt, borderColor: COLORS.accent },
  chipText: { fontWeight: "900", fontSize: 12 },
  chipTextIdle: { color: COLORS.text },
  chipTextActive: { color: COLORS.accent },
});
