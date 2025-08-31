// components/binder/BinderOptionsModal.js
// ADDED: "Information" section that lists controls & gestures
// - Shows how to add/remove/move cards, edge-drag to prev/next page, etc.
// - Lightweight (no new icon deps), themed to your COLORS
// - Fully backward compatible with your existing props & return shape

import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"; // CHANGED: +ScrollView
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

  // ADDED: optional collapse for Information section (starts open)
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    if (visible) {
      setName(initialName || "");
      setLayoutId(initialLayoutId || DEFAULT_TEMPLATE_ID);
      setShowInfo(true); // reset open each time modal opens
    }
  }, [visible, initialName, initialLayoutId]);

  const handleSave = () => onSave?.({ name, layoutId, cover });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Binder options</Text>

          {/* Scroll to avoid clipping on small screens */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {/* Name */}
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Binder name"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            {/* Layout */}
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
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Cover */}
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

            {/* ---------------------------------------------------------------- */}
            {/* ADDED: Information / Controls & Gestures                         */}
            {/* ---------------------------------------------------------------- */}
            <Pressable onPress={() => setShowInfo((v) => !v)} style={styles.infoHeader}>
              <Text style={styles.infoHeaderText}>Information</Text>
              <Text style={styles.infoHeaderToggle}>{showInfo ? "Hide" : "Show"}</Text>
            </Pressable>

            {showInfo && (
              <View style={styles.infoCard}>
                <InfoRow
                  icon="＋"
                  title="Tap empty slot"
                  desc="Opens the drawer to add cards."
                />
                <InfoRow
                  icon="⟲"
                  title="Double-tap a card"
                  desc="Removes the card from that slot."
                />
                <InfoRow
                  icon="⤴︎"
                  title="Long-press a card"
                  desc="Pick it up, then drag over any slot to move it. Dropping overwrites the target and clears the source."
                />
                <InfoRow
                  icon="⇠ ⇢"
                  title="Drag to screen edge"
                  desc="Hover near the left/right edge to move the card to the previous/next page (placed in the first empty slot)."
                />
                <InfoRow
                  icon="🔎"
                  title="From search badge"
                  desc='Cards added from Search show a "From search" badge until they are owned.'
                />
                <InfoRow
                  icon="🗂"
                  title="Add cards (header)"
                  desc="Quickly opens the drawer to add into the current page."
                />
                <InfoRow
                  icon="⚙︎"
                  title="Options (header)"
                  desc="Rename the binder and switch the global layout (rows × cols)."
                />
                <InfoRow
                  icon="＋／－"
                  title="Page controls"
                  desc="Use the pager’s + / − to add or remove pages."
                />
              </View>
            )}
          </ScrollView>

          {/* Actions */}
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

/* -------------------------------------------------------------------------- */
/* Helper: InfoRow                                                            */
/* -------------------------------------------------------------------------- */
// ADDED: small row component with an icon and two-line text
function InfoRow({ icon, title, desc }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBubble}>
        <Text style={styles.infoIconText}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoDesc}>{desc}</Text>
      </View>
    </View>
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
    maxHeight: 560, // ADDED: prevent overflow on short screens
  },
  scrollContent: {
    paddingBottom: 8,
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

  // ADDED: Information styles
  infoHeader: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoHeaderText: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  infoHeaderToggle: { color: COLORS.textMuted, fontWeight: "800", fontSize: 12 },

  infoCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  infoIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    marginTop: 2,
  },
  infoIconText: { color: COLORS.text, fontSize: 13, fontWeight: "900" },
  infoTitle: { color: COLORS.text, fontWeight: "800" },
  infoDesc: { color: COLORS.textMuted, marginTop: 2, lineHeight: 18, fontSize: 13 },

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
