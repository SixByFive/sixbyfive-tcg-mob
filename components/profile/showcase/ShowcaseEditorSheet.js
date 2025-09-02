// components/profile/showcase/ShowcaseEditorSheet.js
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { COLORS } from "../../../theme/colors";

const CARD_RATIO = 63 / 88;

export default function ShowcaseEditorSheet({
  visible,
  onClose,
  onSave,                // (ids: Array<string|number>) => void
  candidates = [],       // [{id, name, image, setName, number}]
  initialSelected = [],  // ids[]
  max = 8,
}) {
  // keep IDs only in state; map back to objects for display
  const [selectedIds, setSelectedIds] = useState(initialSelected);
  const [query, setQuery] = useState("");

  // re-seed when initialSelected changes (e.g., first open)
  React.useEffect(() => {
    if (visible) setSelectedIds(initialSelected);
  }, [visible, initialSelected]);

  const byId = useMemo(() => new Map(candidates.map((c) => [String(c.id), c])), [candidates]);
  const selectedItems = useMemo(
    () => selectedIds.map((id) => byId.get(String(id))).filter(Boolean),
    [selectedIds, byId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const setName = (c.setName || "").toLowerCase();
      const number = String(c.number || "");
      return name.includes(q) || setName.includes(q) || number.includes(q);
    });
  }, [candidates, query]);

  const togglePick = (id) => {
    setSelectedIds((prev) => {
      const s = String(id);
      if (prev.includes(s)) return prev.filter((x) => x !== s);
      if (prev.length >= max) return prev; // respect max
      return [...prev, s];
    });
  };

  const move = (idx, dir) => {
    setSelectedIds((prev) => {
      const j = dir === "left" ? idx - 1 : idx + 1;
      if (j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  };

  const removeAt = (idx) => {
    setSelectedIds((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.head}>
          <Text style={styles.title}>Edit Showcase</Text>
          <Text style={styles.sub}>{selectedIds.length}/{max} selected</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => onSave?.(selectedIds)} style={styles.doneBtn} hitSlop={8}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        {/* Selected grid */}
        <View style={styles.selectedWrap}>
          {selectedItems.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="images-outline" size={18} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Pick up to {max} cards to feature</Text>
            </View>
          ) : (
            <View style={styles.selGrid}>
              {selectedItems.map((it, i) => (
                <View key={`${it.id}-${i}`} style={styles.selCard}>
                  {it?.image ? (
                    <Image source={{ uri: it.image }} style={styles.selThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.selThumb} />
                  )}
                  <View style={styles.selTools}>
                    <Pressable onPress={() => move(i, "left")} hitSlop={8} style={styles.toolBtn}>
                      <Ionicons name="chevron-back" size={14} color={COLORS.text} />
                    </Pressable>
                    <Pressable onPress={() => removeAt(i)} hitSlop={8} style={styles.toolBtn}>
                      <Ionicons name="close" size={14} color={COLORS.text} />
                    </Pressable>
                    <Pressable onPress={() => move(i, "right")} hitSlop={8} style={styles.toolBtn}>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.text} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Search + list */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your cards…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => {
            const picked = selectedIds.includes(String(item.id));
            const disabled = !picked && selectedIds.length >= max;
            return (
              <View style={styles.row}>
                {item?.image ? (
                  <Image source={{ uri: item.image }} style={styles.rowThumb} />
                ) : (
                  <View style={styles.rowThumb} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.setName}  #{item.number}
                  </Text>
                </View>
                <Pressable
                  onPress={() => togglePick(item.id)}
                  disabled={disabled}
                  style={({ pressed }) => [
                    styles.pickBtn,
                    picked ? styles.pickOn : styles.pickOff,
                    disabled && { opacity: 0.45 },
                    pressed && { opacity: 0.9 },
                  ]}
                  hitSlop={6}
                >
                  {picked ? (
                    <>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                      <Text style={styles.pickTextOn}>Added</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="add" size={14} color="#fff" />
                      <Text style={styles.pickTextOff}>Add</Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0008" },

  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    maxHeight: "80%",
  },

  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  title: { color: COLORS.text, fontWeight: "900" },
  sub: { color: COLORS.textMuted, fontSize: 12 },

  doneBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.accent, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  doneText: { color: "#fff", fontWeight: "900" },

  selectedWrap: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  emptyRow: { alignItems: "center", gap: 8, paddingVertical: 8 },
  emptyText: { color: COLORS.textMuted, fontWeight: "800" },

  selGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selCard: {
    width: 72, borderRadius: 10, overflow: "hidden",
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.alt,
  },
  selThumb: { width: "100%", aspectRatio: CARD_RATIO },
  selTools: { position: "absolute", top: 4, left: 4, right: 4, flexDirection: "row", justifyContent: "space-between" },
  toolBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },

  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    marginBottom: 6,
  },
  input: { flex: 1, color: COLORS.text, paddingVertical: 0 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  rowThumb: {
    width: 36, height: 52, borderRadius: 6,
    backgroundColor: COLORS.alt, borderWidth: 1, borderColor: COLORS.border,
  },
  rowTitle: { color: COLORS.text, fontWeight: "800" },
  rowSub: { color: COLORS.textMuted, fontSize: 12 },

  pickBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10,
  },
  pickOn: { backgroundColor: COLORS.accent, borderWidth: 0 },
  pickOff: { backgroundColor: COLORS.alt, borderWidth: 1, borderColor: COLORS.border },
  pickTextOn: { color: "#fff", fontWeight: "900", fontSize: 12.5 },
  pickTextOff: { color: "#fff", fontWeight: "900", fontSize: 12.5 },
});
