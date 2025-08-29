// components/binder/BinderOptionsModal.js
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "../../theme/colors";

export const TEMPLATES = [
  { id: "pocket-9", label: "9-pocket", rows: 3, cols: 3 },
  { id: "pocket-4", label: "4-pocket", rows: 2, cols: 2 },
  { id: "pocket-3", label: "3-row", rows: 3, cols: 1 },
  { id: "full",      label: "Full",    rows: 1, cols: 1 },
];
export const DEFAULT_TEMPLATE_ID = "pocket-9";

export default function BinderOptionsModal({
  visible,
  initialName,
  initialLayoutId,
  onClose,
  onSave,
}) {
  const [name, setName] = useState(initialName || "");
  const [layoutId, setLayoutId] = useState(initialLayoutId || DEFAULT_TEMPLATE_ID);
  const [cover, setCover] = useState("cover1");

  useEffect(() => {
    if (visible) {
      setName(initialName || "");
      setLayoutId(initialLayoutId || DEFAULT_TEMPLATE_ID);
    }
  }, [visible, initialName, initialLayoutId]);

  const handleSave = () => onSave?.({ name, layoutId, cover });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Binder options</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Binder name"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Layout (applies to all pages)</Text>
          <View style={styles.segmentWrap}>
            {TEMPLATES.map((t) => {
              const active = layoutId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setLayoutId(t.id)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Cover</Text>
          <View style={styles.coversRow}>
            {["cover1", "cover2", "cover3"].map((c, i) => {
              const active = cover === c;
              const swatch = ["#23243c", "#1a1f2e", "#2a1f2a"][i];
              return (
                <Pressable
                  key={c}
                  onPress={() => setCover(c)}
                  style={[
                    styles.coverBox,
                    { backgroundColor: swatch },
                    active && { borderColor: COLORS.accent, borderWidth: 2 },
                  ]}
                />
              );
            })}
          </View>

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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginBottom: 8 },
  label: { color: COLORS.textMuted, fontWeight: "800", marginBottom: 6 },
  input: {
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  segment: { paddingVertical: 6, paddingHorizontal: 10 },
  segmentActive: { backgroundColor: COLORS.accent },
  segmentText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  segmentTextActive: { color: "#fff" },

  coversRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  coverBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderColor: COLORS.border,
    borderWidth: 1,
  },

  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btnGhost: {
    flex: 1,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnGhostText: { color: COLORS.text, fontWeight: "800" },
  btnPrimary: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
});
