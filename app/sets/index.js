// app/sets/index.js
// Uses PageHeaderBackSimple for the page header.
// Keeps the compact horizontal chips + modal era picker.

import { useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import SetLogo from "../../components/sets/SetLogo.native";
import { COLORS } from "../../theme/colors";
import inferSetEra from "../../utils/setEra.native";
import { SearchSetsDocument } from "@sixbyfive/tcg-binder/client";

/* ---------------- Era labels & order ---------------- */
const ERA_LABELS = {
  wotc: "Wizards of the Coast",
  ecard: "e-Card",
  ex: "EX",
  dp: "Diamond & Pearl",
  hgss: "HeartGold & SoulSilver",
  bw: "Black & White",
  xy: "XY",
  sm: "Sun & Moon",
  swsh: "Sword & Shield",
  sv: "Scarlet & Violet",
  me: "Mega Evolutions",
  misc: "Special / Misc",
};

const ERA_ORDER = ["me", "sv", "swsh", "sm", "xy", "bw", "hgss", "dp", "ex", "ecard", "wotc", "misc"];
function eraRank(key) {
  const k = (key || "misc").toLowerCase();
  const idx = ERA_ORDER.indexOf(k);
  return idx === -1 ? ERA_ORDER.length - 1 : idx;
}

/* ---------------- Sorting (promo-first + numeric code) ---------------- */
function isPromoCode(code) {
  if (!code) return false;
  const trimmed = String(code).trim().toLowerCase();
  return trimmed.endsWith("p") || trimmed.includes("promo");
}
function extractCodeNumber(code) {
  if (!code) return Number.POSITIVE_INFINITY;
  const match = String(code).toLowerCase().match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}
function compareByCode(a, b) {
  const codeA = String(a?.code || "").toLowerCase();
  const codeB = String(b?.code || "").toLowerCase();
  const promoA = isPromoCode(codeA) ? 0 : 1;
  const promoB = isPromoCode(codeB) ? 0 : 1;
  if (promoA !== promoB) return promoA - promoB;

  const numA = extractCodeNumber(codeA);
  const numB = extractCodeNumber(codeB);
  if (numA !== numB) return numA - numB;

  if (codeA && codeB) return codeA.localeCompare(codeB);
  if (codeA || codeB) return codeB ? -1 : 1;
  return 0;
}

const PAGE_SIZE = 500;

export default function SetsIndexScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [eraFilter, setEraFilter] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, loading, error } = useQuery(SearchSetsDocument, {
    variables: { query: null, limit: PAGE_SIZE, offset: 0 },
    fetchPolicy: "cache-first",
  });

  const sets = useMemo(() => {
    const raw = Array.isArray(data?.searchSets) ? data.searchSets : [];
    return raw
      .map((s) => ({
        code: s.code,
        name: s.name || String(s.code).toUpperCase(),
        totalCards: Number.isFinite(s.total) ? s.total : null,
        era: inferSetEra(s),
        abbr: s.abbr ?? null,
        series: s.series ?? null,
      }))
      .sort(compareByCode);
  }, [data]);

  const erasInData = useMemo(() => {
    const present = Array.from(new Set(sets.map((s) => s.era || "misc")));
    return present.sort((a, b) => eraRank(a) - eraRank(b));
  }, [sets]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byEra = new Map();

    for (const set of sets) {
      if (eraFilter !== "all" && set.era !== eraFilter) continue;
      if (q) {
        const name = (set.name || "").toLowerCase();
        const code = (set.code || "").toLowerCase();
        const abbr = (set.abbr || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !abbr.includes(q)) continue;
      }
      const key = set.era || "misc";
      if (!byEra.has(key)) byEra.set(key, []);
      byEra.get(key).push(set);
    }

    for (const arr of byEra.values()) arr.sort(compareByCode);

    const out = Array.from(byEra.entries()).map(([key, items]) => ({
      title: ERA_LABELS[key] || ERA_LABELS.misc,
      eraKey: key,
      data: items,
    }));

    out.sort((a, b) => eraRank(a.eraKey) - eraRank(b.eraKey));
    return out;
  }, [sets, query, eraFilter]);

  /* ---------- Loading / Error ---------- */
  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
        <Text style={[styles.muted, { marginTop: 10 }]}>Loading sets…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.screen, { padding: 16 }]}>
        <View style={[styles.card, { borderColor: "#b24848", backgroundColor: "#2a1d1d" }]}>
          <Text style={[styles.title, { color: "#ffb0b0" }]}>Unable to load sets</Text>
          <Text style={[styles.muted, { marginTop: 6 }]} selectable>
            {String(error.message)}
          </Text>
        </View>
      </View>
    );
  }

  // ✅ FIXED: Use PageHeaderBackSimple and return a single element for ListHeaderComponent
  const listHeader = (
    <View>
      <PageHeaderBackSimple title="Pokémon TCG Sets" />
      <View style={styles.card}>
        {/* Search input */}
        <View style={styles.inputRow}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            placeholder="Search sets by name, code, or abbr…"
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.input}
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Compact horizontal chip bar + 'More' button */}
        <View style={styles.compactBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsBarContent}
          >
            <Chip
              label="All"
              active={eraFilter === "all"}
              onPress={() => setEraFilter("all")}
              compact
            />
            {erasInData.map((k) => (
              <Chip
                key={k}
                label={ERA_LABELS[k] || ERA_LABELS.misc}
                active={eraFilter === k}
                onPress={() => setEraFilter(k)}
                compact
              />
            ))}
          </ScrollView>

          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="More filters"
            hitSlop={6}
          >
            <Ionicons name="filter" size={14} color={COLORS.accent} />
            <Text style={styles.moreBtnText}>More</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.code}
        ListHeaderComponent={listHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 24 }}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.setCard, pressed && { opacity: 0.94 }]}
            onPress={() => router.push(`/sets/${item.code}`)}
          >
            <View style={styles.thumbWrap}>
              <SetLogo name={item.name} code={item.code} size={90} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.setTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                Code: {String(item.code).toUpperCase()}
                {item.abbr ? `  •  Abbr: ${item.abbr}` : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={[styles.card, { alignItems: "center" }]}>
            <Text style={styles.muted}>No sets match your filters.</Text>
          </View>
        }
      />

      {/* Era picker modal (radio list) */}
      <Modal
        animationType="fade"
        transparent
        visible={pickerOpen}
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Era</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </Pressable>
            </View>

            <Pressable style={styles.radioRow} onPress={() => setEraFilter("all")}>
              <Radio checked={eraFilter === "all"} />
              <Text style={styles.radioLabel}>All</Text>
            </Pressable>

            {ERA_ORDER.map((k) => (
              <Pressable key={k} style={styles.radioRow} onPress={() => setEraFilter(k)}>
                <Radio checked={eraFilter === k} />
                <Text style={styles.radioLabel}>{ERA_LABELS[k]}</Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setPickerOpen(false)}
              style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------------- UI bits ---------------- */

function Chip({ label, active, onPress, compact = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        active ? styles.chipActive : styles.chipInactive,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Text
        style={[
          styles.chipText,
          compact && styles.chipTextCompact,
          active && styles.chipTextActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Radio({ checked }) {
  return (
    <View style={[styles.radioOuter, checked && styles.radioOuterChecked]}>
      {checked ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

/* ---------------- Styles ---------------- */

const TILE_BG = "#1c1d24";
const THUMB_BG = COLORS.alt;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingTop: 12,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },

  title: { color: COLORS.text, fontWeight: "900", fontSize: 18 },

  inputRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TILE_BG,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 0,
  },

  /* ---- compact horizontal chip bar ---- */
  compactBar: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipsBarContent: {
    paddingRight: 6,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  chipInactive: {
    backgroundColor: TILE_BG,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  chipTextCompact: { fontSize: 11.5 },
  chipTextActive: { color: "#fff" },

  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.alt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  moreBtnText: { color: COLORS.accent, fontWeight: "800", fontSize: 12 },

  sectionLabel: {
    color: COLORS.textMuted,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 4,
  },

  // Set row tile
  setCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TILE_BG,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  thumbWrap: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: THUMB_BG,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  setTitle: { color: COLORS.text, fontWeight: "900" },
  meta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  muted: { color: COLORS.textMuted },

  /* ---- Modal styles ---- */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  radioLabel: { color: COLORS.text, fontWeight: "800" },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterChecked: { borderColor: COLORS.accent },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },

  applyBtn: {
    marginTop: 8,
    alignSelf: "flex-end",
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  applyText: { color: "#fff", fontWeight: "900" },
});
