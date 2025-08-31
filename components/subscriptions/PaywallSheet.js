// components/subscriptions/PaywallSheet.js

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

export default function PaywallSheet({ open, onClose, planName, price, period, onConfirm }) {
  if (!open) return null;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} visible={open}>
      <Pressable style={styles.backdrop} onPress={onClose}><View /></Pressable>
      <View style={styles.card}>
        <Text style={styles.title}>Start {planName}</Text>
        <Text style={styles.body}>You’ll begin a 7-day free trial. Then {price}{period}. Cancel anytime.</Text>
        <Pressable style={styles.primary} onPress={onConfirm}><Text style={styles.primaryText}>Confirm</Text></Pressable>
        <Pressable style={styles.secondary} onPress={onClose}><Text style={styles.secondaryText}>Not now</Text></Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#0008" },
  card: {
    position: "absolute", left: 12, right: 12, bottom: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, padding: 14,
  },
  title: { color: COLORS.text, fontWeight: "900", marginBottom: 6 },
  body: { color: COLORS.textMuted, marginBottom: 12 },
  primary: { backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
  secondary: { marginTop: 8, backgroundColor: COLORS.alt, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  secondaryText: { color: COLORS.text, fontWeight: "800" },
});
