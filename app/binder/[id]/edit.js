// app/binder/[id]/edit.js
// NEW: Binder editor UI-only: page selector + page grid with slots.
// Long-press a slot to open a bottom sheet–style actions row (UI-only).

import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import PageHeaderBack from "../../../components/common/PageHeaderBack";
import { COLORS } from "../../../theme/colors";

const DEFAULT_TEMPLATE = "pocket-9";

export default function BinderEditor() {
  const { id } = useLocalSearchParams();

  // UI-only state; replace with real binder data
  const [name, setName] = useState("My Binder");
  const [pages, setPages] = useState([
    { id: "p1", template: DEFAULT_TEMPLATE, title: "Page 1" },
    { id: "p2", template: "pocket-4", title: "Page 2" },
  ]);
  const [active, setActive] = useState(0);
  const [slotActions, setSlotActions] = useState(null); // { pageIndex, slotIndex }

  const page = pages[active];

  const onAddPage = () => {
    const pid = Math.random().toString(36).slice(2, 8);
    setPages((p) => [...p, { id: pid, template: DEFAULT_TEMPLATE, title: `Page ${p.length + 1}` }]);
    setActive(pages.length);
  };

  const onRename = () => {
    Alert.prompt?.("Rename binder", "Enter a new name", [
      { text: "Cancel", style: "cancel" },
      { text: "Save", onPress: (txt) => txt && setName(txt) },
    ]);
  };

  const onPageOptions = () => {
    Alert.alert("Page options", "UI-only actions", [
      { text: "Move left", onPress: () => setActive((i) => Math.max(0, i - 1)) },
      { text: "Move right", onPress: () => setActive((i) => Math.min(pages.length - 1, i + 1)) },
      { text: "Delete page", style: "destructive", onPress: () => {
        if (pages.length <= 1) return;
        const newPages = pages.filter((_, i) => i !== active);
        setPages(newPages);
        setActive((i) => Math.max(0, i - 1));
      }},
      { text: "Close", style: "cancel" },
    ]);
  };

  const onSlotLongPress = (slotIndex) => {
    setSlotActions({ pageIndex: active, slotIndex });
  };

  const onActionTakePhoto = () => {
    // TODO: open camera for scanning / taking photo
    setSlotActions(null);
  };
  const onActionPick = () => {
    // TODO: open picker; later attach card to slot
    setSlotActions(null);
  };
  const onActionClear = () => {
    // TODO: clear slot contents
    setSlotActions(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBack
        title={name}
        subtitle={`Editing • ${pages.length} page${pages.length > 1 ? "s" : ""}`}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <HeaderBtn label="Rename" onPress={onRename} />
            <HeaderBtn label="+ Page" onPress={onAddPage} />
            <HeaderBtn label="Options" onPress={onPageOptions} />
          </View>
        }
      />

      {/* Page picker */}
      <FlatList
        data={pages}
        keyExtractor={(p) => p.id}
        horizontal
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
        renderItem={({ item, index }) => {
          const activeStyle = index === active;
          return (
            <Pressable
              onPress={() => setActive(index)}
              style={({ pressed }) => [
                styles.pageChip,
                activeStyle && styles.pageChipActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[styles.pageChipText, activeStyle && styles.pageChipTextActive]}>
                {item.title}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Page grid */}
      <View style={styles.pageWrap}>
        <PageGrid template={page.template} onSlotLongPress={onSlotLongPress} />
      </View>

      {/* Slot actions "sheet" */}
      {slotActions && (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Slot actions</Text>
          <View style={styles.sheetRow}>
            <SheetBtn label="Take photo" onPress={onActionTakePhoto} />
            <SheetBtn label="Pick card" onPress={onActionPick} />
            <SheetBtn label="Clear" destructive onPress={onActionClear} />
            <SheetBtn label="Close" onPress={() => setSlotActions(null)} />
          </View>
        </View>
      )}
    </View>
  );
}

function HeaderBtn({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.hBtn, pressed && { opacity: 0.85 }]}>
      <Text style={styles.hBtnText}>{label}</Text>
    </Pressable>
  );
}

function SheetBtn({ label, onPress, destructive }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sBtn, pressed && { opacity: 0.9 }]}>
      <Text style={[styles.sBtnText, destructive && { color: "#ff6b6b" }]}>{label}</Text>
    </Pressable>
  );
}

function PageGrid({ template, onSlotLongPress }) {
  // Map template to rows/cols
  const { rows, cols } = useMemo(() => {
    if (template === "pocket-4") return { rows: 2, cols: 2 };
    if (template === "pocket-3") return { rows: 3, cols: 1 };
    if (template === "full") return { rows: 1, cols: 1 };
    return { rows: 3, cols: 3 }; // pocket-9
  }, [template]);

  const total = rows * cols;
  const cells = Array.from({ length: total });

  return (
    <View style={[styles.grid, { gridTemplateRows: undefined }]}>
      {/* Use a simple flex grid; evenly size via aspect ratios */}
      <View style={{ gap: 8 }}>
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: "row", gap: 8 }}>
            {Array.from({ length: cols }).map((__, c) => {
              const idx = r * cols + c;
              return (
                <Pressable
                  key={c}
                  onLongPress={() => onSlotLongPress(idx)}
                  style={({ pressed }) => [styles.cell, pressed && { opacity: 0.9 }]}
                >
                  <View style={styles.cellInset}>
                    {/* Placeholder; later render thumb/name if slot has a card */}
                    <Text style={styles.cellText}>+</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageChip: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  pageChipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.alt },
  pageChipText: { color: COLORS.textMuted, fontWeight: "800" },
  pageChipTextActive: { color: COLORS.text },

  pageWrap: { paddingHorizontal: 12, paddingBottom: 16 },

  grid: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 12, padding: 12,
  },
  cell: { flex: 1, aspectRatio: 1, flexBasis: 0 },
  cellInset: {
    flex: 1, backgroundColor: COLORS.background,
    borderColor: COLORS.border, borderWidth: 1, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cellText: { color: COLORS.textMuted, fontSize: 22, fontWeight: "900" },

  // header buttons
  hBtn: {
    backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  hBtnText: { color: COLORS.text, fontWeight: "800" },

  // slot sheet
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border, borderTopWidth: 1,
    padding: 12, gap: 10,
  },
  sheetTitle: { color: COLORS.text, fontWeight: "900" },
  sheetRow: { flexDirection: "row", gap: 8 },
  sBtn: {
    flex: 1,
    borderColor: COLORS.border, borderWidth: 1, backgroundColor: COLORS.background,
    borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  sBtnText: { color: COLORS.text, fontWeight: "800" },
});
