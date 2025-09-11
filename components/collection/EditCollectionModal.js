// components/collection/EditCollectionModal.js
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import NumberStepper from "../common/NumberStepper";

const CONDITION_OPTIONS = [
  { key: "near_mint", label: "Near Mint" },
  { key: "lightly_played", label: "Lightly Played" },
  { key: "moderately_played", label: "Moderately Played" },
  { key: "heavily_played", label: "Heavily Played" },
  { key: "damaged", label: "Damaged" },
];

export default function EditCollectionModal({
  visible = false,
  onClose,
  card, // { id, name, _collection: { quantity, condition, variation } }
  onSubmit, // ({ quantity, condition }) => void
  saving = false,
}) {
  const seed = useMemo(() => {
    const q = Number(card?._collection?.quantity ?? 1) || 1;
    const c = String(card?._collection?.condition ?? "near_mint");
    return { quantity: q, condition: c };
  }, [card]);

  const [quantity, setQuantity] = useState(seed.quantity);
  const [condition, setCondition] = useState(seed.condition);

  // Refresh state if card changes (new selection)
  React.useEffect(() => {
    setQuantity(seed.quantity);
    setCondition(seed.condition);
  }, [seed.quantity, seed.condition]);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit card</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {card?.name ?? "Card"}
          </Text>

          <View style={{ height: 12 }} />

          <Text style={styles.label}>Quantity</Text>
          <NumberStepper value={quantity} min={0} max={999} onChange={setQuantity} />

          <View style={{ height: 16 }} />

          <Text style={styles.label}>Condition</Text>
          <View style={styles.condRow}>
            {CONDITION_OPTIONS.map((opt) => {
              const selected = condition === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setCondition(opt.key)}
                  style={[
                    styles.pill,
                    selected && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
                  ]}
                >
                  <Text style={[styles.pillText, selected && { color: "#fff", fontWeight: "900" }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 20 }} />

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, styles.secondary]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={() => onSubmit?.({ quantity, condition })}
              style={[styles.btn, styles.primary, saving && { opacity: 0.6 }]}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>
                {saving ? "Saving…" : "Save"}
              </Text>
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
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: COLORS.textMuted, marginTop: 2 },
  label: { color: COLORS.textMuted, marginBottom: 8, marginTop: 4 },
  condRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pillText: { color: COLORS.text, fontWeight: "800", fontSize: 12.5 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  primary: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  secondary: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  btnText: { color: COLORS.text, fontWeight: "800" },
});
