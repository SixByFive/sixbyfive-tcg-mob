// app/binder/new.js
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert, Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import PageHeaderBackSimple from "../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../theme/colors";

// Site palette parity
import { STANDARD_COLOURS } from "../../components/binders/WizardStepCover";

// Shared actions
import useBinderActions from "../../hooks/useBinderActions";

const TEMPLATES = [
  { id: "pocket-9", label: "9-pocket", rows: 3, cols: 3 },
  { id: "pocket-4", label: "4-pocket", rows: 2, cols: 2 },
  { id: "pocket-3", label: "3-row", rows: 3, cols: 1 },
  { id: "full",     label: "Full",    rows: 1, cols: 1 },
];

export default function BinderNewScreen() {
  const { createBinder } = useBinderActions();

  const [name, setName] = useState("");
  const [coverIndex, setCoverIndex] = useState(0);
  const [templateId, setTemplateId] = useState("pocket-9");
  const [creating, setCreating] = useState(false);

  const canCreate = name.trim().length > 0 && STANDARD_COLOURS[coverIndex] && !!templateId;
  const tpl = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0],
    [templateId]
  );

  const onCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const cover = STANDARD_COLOURS[coverIndex];
      // Create with allowed input; hook will best-effort update rows/cols afterwards
      const created = await createBinder({
        name: name.trim(),
        templateId,   // desired size
        cover,        // { name, color, accent, elasticColor }
      });

      if (!created?.id) throw new Error("No binder id returned");
      router.replace(`/binder/${String(created.id)}/edit`);
    } catch (e) {
      Alert.alert(
        "Couldn’t create binder",
        e?.graphQLErrors?.[0]?.message || e?.message || "Please try again."
      );
    } finally {
      setCreating(false);
    }
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
          <View style={styles.coversGrid}>
            {STANDARD_COLOURS.map((c, i) => {
              const active = i === coverIndex;
              return (
                <Pressable
                  key={c.name}
                  onPress={() => setCoverIndex(i)}
                  style={[
                    styles.coverBox,
                    { backgroundColor: c.color },
                    active && styles.coverBoxActive,
                  ]}
                >
                  <View style={[styles.coverAccent, { backgroundColor: c.accent }]} />
                  <Text style={styles.coverLabel} numberOfLines={1}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>You can update the cover from binder options anytime.</Text>
        </View>

        {/* Template */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Template</Text>

          <View style={styles.segmentWrap}>
            {TEMPLATES.map((t) => {
              const active = t.id === templateId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTemplateId(t.id)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t.label}</Text>
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
          disabled={!canCreate || creating}
          style={({ pressed }) => [
            styles.btnPrimary,
            ((!canCreate || creating || pressed) && { opacity: 0.9 }),
          ]}
        >
          <Text style={styles.btnPrimaryText}>
            {creating ? "Creating…" : "Create binder"}
          </Text>
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

  coversGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  coverBox: {
    width: "23.5%",
    minWidth: 74,
    aspectRatio: 1,
    borderRadius: 10,
    borderColor: COLORS.border,
    borderWidth: 1,
    padding: 8,
    justifyContent: "flex-end",
  },
  coverBoxActive: { borderColor: COLORS.accent, borderWidth: 2 },
  coverAccent: { position: "absolute", left: 8, top: 8, width: 10, height: 18, borderRadius: 4 },
  coverLabel: { color: "#fff", fontWeight: "800", fontSize: 12 },

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
