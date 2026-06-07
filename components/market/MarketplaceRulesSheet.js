// components/market/MarketplaceRulesSheet.js
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  MarketplaceRulesDocument,
  AgreeToMarketplaceRulesDocument,
} from "../../graphql/documents";

export default function MarketplaceRulesSheet({ visible, isLoggedIn, onAgreed }) {
  const insets = useSafeAreaInsets();
  const [confirmed, setConfirmed] = useState(false);

  const { data, loading: rulesLoading } = useQuery(MarketplaceRulesDocument, {
    fetchPolicy: "cache-first",
    skip: !visible,
  });
  const rules = data?.marketplaceRules ?? [];

  const [agree, { loading: agreeing, error }] = useMutation(
    AgreeToMarketplaceRulesDocument,
    { onCompleted: () => onAgreed?.() }
  );

  function handleAgree() {
    if (isLoggedIn) agree();
    else onAgreed?.();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconEmoji}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Marketplace Rules</Text>
            <Text style={styles.subtitle}>
              Before you buy or sell, you must agree to our marketplace rules.
            </Text>
          </View>
        </View>

        {/* Rules list */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          {rulesLoading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginTop: 32 }} />
          ) : rules.length === 0 ? (
            <Text style={styles.emptyText}>No rules loaded.</Text>
          ) : (
            rules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <View style={styles.ruleNum}>
                  <Text style={styles.ruleNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
          <Pressable onPress={() => setConfirmed(v => !v)} style={styles.checkRow}>
            <View style={[styles.checkbox, confirmed && styles.checkboxActive]}>
              {confirmed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>
              I have read and agree to the marketplace rules. I understand that violations may result
              in listing removal or account suspension.
            </Text>
          </Pressable>

          {error && <Text style={styles.errText}>{error.message}</Text>}

          <Pressable
            onPress={handleAgree}
            disabled={!confirmed || agreeing || rulesLoading}
            style={[styles.agreeBtn, (!confirmed || agreeing || rulesLoading) && { opacity: 0.4 }]}
          >
            {agreeing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.agreeBtnText}>I agree — take me to the marketplace</Text>
            }
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(99,102,241,0.15)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 20 },
  title: { color: COLORS.text, fontWeight: "700", fontSize: 15, marginBottom: 3 },
  subtitle: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },

  scrollContent: { padding: 16, gap: 12 },
  ruleRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ruleNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  ruleNumText: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700" },
  ruleText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  emptyText: { color: COLORS.textMuted, textAlign: "center", marginTop: 32 },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  checkboxActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  checkmark: { color: "#fff", fontSize: 11, fontWeight: "800" },
  checkLabel: { flex: 1, color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  errText: { color: COLORS.error, fontSize: 12 },

  agreeBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  agreeBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
