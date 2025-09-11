// components/collection/RemoveQuantityModal.js
import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import NumberStepper from "../common/NumberStepper";

export default function RemoveQuantityModal({
  visible = false,
  onClose,
  card,          // { _collection: { quantity } }
  onConfirm,     // (countToRemove) => void
  removing = false,
}) {
  const maxQty = useMemo(() => Number(card?._collection?.quantity ?? 1) || 1, [card]);
  const [qty, setQty] = useState(Math.min(1, maxQty));

  React.useEffect(() => {
    const m = Number(card?._collection?.quantity ?? 1) || 1;
    setQty(Math.min(1, m));
  }, [card]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Remove from collection</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {card?.name ?? "Card"}
          </Text>

          <View style={{ height: 12 }} />
          <Text style={styles.label}>How many do you want to remove?</Text>

          <NumberStepper value={qty} min={1} max={maxQty} onChange={setQty} />

          <View style={{ height: 20 }} />

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.btn, styles.secondary]}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={removing}
              onPress={() => onConfirm?.(qty)}
              style={[styles.btn, styles.danger, removing && { opacity: 0.6 }]}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>
                {removing ? "Removing…" : "Remove"}
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
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  danger: { backgroundColor: "#e23b3b", borderColor: "#e23b3b" },
  secondary: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  btnText: { color: COLORS.text, fontWeight: "800" },
});
