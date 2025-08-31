// app/binder/new.js

import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../theme/colors";

// Templates (same shape as elsewhere so it stays familiar)
const TEMPLATES = [
  { id: "pocket-9", label: "9-pocket", rows: 3, cols: 3 },
  { id: "pocket-4", label: "4-pocket", rows: 2, cols: 2 },
  { id: "pocket-3", label: "3-row", rows: 3, cols: 1 },
  { id: "full",     label: "Full",    rows: 1, cols: 1 },
];

export default function BinderNewScreen() {
  const [name, setName] = useState("");
  const [coverId, setCoverId] = useState("cover1");
  const [templateId, setTemplateId] = useState("pocket-9");

  const canCreate = name.trim().length > 0 && !!coverId && !!templateId;
  const tpl = useMemo(
    () => TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0],
    [templateId]
  );

  const onCreate = () => {
    if (!canCreate) return;
    // TODO: replace with createBinder mutation and returned binder id
    const fakeId = Math.random().toString(36).slice(2, 8);
    router.replace(`/binder/${fakeId}/edit`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple title="New binder" subtitle="Create a binder to organise your cards" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Main Binder, Trades, Deck Lists…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
            returnKeyType="done"
          />
          <Text style={styles.hint}>Pick something descriptive. You can change this later.</Text>
        </View>

        {/* Cover */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cover</Text>
          <View style={styles.coversRow}>
            {["cover1", "cover2", "cover3", "cover4"].map((c, i) => {
              const active = c === coverId;
              // simple themed swatches (swap for real images later)
              const swatch = ["#23243c", "#1a1f2e", "#2a1f2a", "#26222e"][i];
              return (
                <Pressable
                  key={c}
                  onPress={() => setCoverId(c)}
                  style={[
                    styles.coverBox,
                    { backgroundColor: swatch },
                    active && styles.coverBoxActive,
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.hint}>You can update the cover from binder options anytime.</Text>
        </View>

        {/* Template */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Template</Text>

          <View style={styles.segmentWrap}>
            {TEMPLATES.map(t => {
              const active = t.id === templateId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTemplateId(t.id)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Mini preview */}
          <View style={styles.preview}>
            {Array.from({ length: tpl.rows }).map((_, r) => (
              <View key={r} style={styles.previewRow}>
                {Array.from({ length: tpl.cols }).map((__, c) => (
                  <View key={c} style={styles.previewCell}>
                    <View style={styles.previewInset} />
                  </View>
                ))}
              </View>
            ))}
          </View>

          <Text style={styles.hint}>
            The layout applies to all pages and can be changed later in Options.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.btnGhost, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.btnGhostText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onCreate}
          disabled={!canCreate}
          style={({ pressed }) => [
            styles.btnPrimary,
            (!canCreate || pressed) && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.btnPrimaryText}>Create binder</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- styles ---------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 10 },

  input: {
    backgroundColor: COLORS.alt,
    color: COLORS.text,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  hint: { color: COLORS.textMuted, marginTop: 8, fontSize: 12.5 },

  coversRow: { flexDirection: "row", gap: 10 },
  coverBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  coverBoxActive: { borderColor: COLORS.accent, borderWidth: 2 },

  segmentWrap: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  segment: { paddingVertical: 8, paddingHorizontal: 12 },
  segmentActive: { backgroundColor: COLORS.accent },
  segmentText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  segmentTextActive: { color: "#fff" },

  preview: {
    marginTop: 12,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  previewRow: { flexDirection: "row", gap: 6 },
  previewCell: { flex: 1, flexBasis: 0, aspectRatio: 1 },
  previewInset: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
  },

  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  btnGhost: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    flex: 1,
  },
  btnGhostText: { color: COLORS.text, fontWeight: "800" },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    flex: 1,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
});
