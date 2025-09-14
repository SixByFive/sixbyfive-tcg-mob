// components/binder/BinderOptionsModal.js
// Pure UI modal for binder options in the editor.
// It DOES NOT call mutations itself. It returns a payload to the parent via onSave
// with { name, layoutId, rows, cols, cover } so the parent can call updateBinder.

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { COLORS } from "../../theme/colors";
import WizardStepCover, { STANDARD_COLOURS } from "../binders/WizardStepCover";

export const TEMPLATES = [
  { id: "pocket-9", label: "9-pocket", rows: 3, cols: 3 },
  { id: "pocket-4", label: "4-pocket", rows: 2, cols: 2 },
  { id: "pocket-3", label: "3-row", rows: 3, cols: 1 },
  { id: "full",     label: "Full",    rows: 1, cols: 1 },
];
export const DEFAULT_TEMPLATE_ID = "pocket-9";
const DEFAULT_COVER = STANDARD_COLOURS[0];

export default function BinderOptionsModal({
  visible,
  initialName,
  initialLayoutId,
  initialCover,
  onClose,
  onSave,
}) {
  const [name, setName] = useState(initialName || "");
  const [layoutId, setLayoutId] = useState(initialLayoutId || DEFAULT_TEMPLATE_ID);
  const [cover, setCover] = useState(normalizeCover(initialCover) || DEFAULT_COVER);

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === layoutId) || TEMPLATES[0],
    [layoutId]
  );

  useEffect(() => {
    if (visible) {
      setName(initialName || "");
      setLayoutId(initialLayoutId || DEFAULT_TEMPLATE_ID);
      setCover(normalizeCover(initialCover) || DEFAULT_COVER);
    }
  }, [visible, initialName, initialLayoutId, initialCover]);

  const handleSave = () => {
    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      Alert.alert("Name required", "Please enter a binder name.");
      return;
    }

    // Return concrete rows/cols + the UI id
    const payload = {
      name: trimmedName,
      layoutId,            // for UI continuity
      rows: template.rows, // <-- what backend expects
      cols: template.cols, // <-- what backend expects
      cover: {
        name: cover?.name,
        color: cover?.color,
        accent: cover?.accent,
        elasticColor: cover?.elasticColor || "#181822",
      },
    };

    onSave?.(payload);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Binder options</Text>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Binder name"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              returnKeyType="done"
            />

            <Text style={[styles.label, { marginTop: 12 }]}>
              Layout (applies to all pages)
            </Text>
            <View style={styles.segmentWrap}>
              {TEMPLATES.map((t) => {
                const active = layoutId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setLayoutId(t.id)}
                    style={[styles.segment, active && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <WizardStepCover value={cover} onChange={setCover} />

            <Text style={{ color: COLORS.textMuted, marginTop: 8, fontSize: 12 }}>
              Selected layout: {template.rows}×{template.cols}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------- helpers ---------------- */
function normalizeCover(input) {
  if (!input) return null;
  if (typeof input === "string") {
    return STANDARD_COLOURS.find((c) => c.name === input) || null;
  }
  if (input && typeof input === "object") {
    if (input.name) {
      const match = STANDARD_COLOURS.find((c) => c.name === input.name);
      if (match) return match;
    }
    const match = STANDARD_COLOURS.find(
      (c) =>
        c.color?.toLowerCase() === (input.color || "").toLowerCase() &&
        c.accent?.toLowerCase() === (input.accent || "").toLowerCase()
    );
    if (match) return match;
    return {
      name: input.name || "Custom",
      color: input.color,
      accent: input.accent,
      elasticColor: input.elasticColor || "#181822",
    };
  }
  return null;
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 16 },
  card: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 14, maxHeight: 560 },
  scrollContent: { paddingBottom: 8 },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginBottom: 8 },
  label: { color: COLORS.textMuted, fontWeight: "800", marginBottom: 6 },
  input: {
    backgroundColor: COLORS.alt, color: COLORS.text,
    borderColor: COLORS.border, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  segmentWrap: {
    flexDirection: "row", backgroundColor: COLORS.background,
    borderColor: COLORS.border, borderWidth: 1, borderRadius: 999, overflow: "hidden",
  },
  segment: { paddingVertical: 6, paddingHorizontal: 10 },
  segmentActive: { backgroundColor: COLORS.accent },
  segmentText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  segmentTextActive: { color: "#fff" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btnGhost: {
    flex: 1, backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 10, paddingVertical: 10, alignItems: "center",
  },
  btnGhostText: { color: COLORS.text, fontWeight: "800" },
  btnPrimary: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
});
