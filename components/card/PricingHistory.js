// components/card/PricingHistory.js
// NOTE: no structural changes; just keeps your latest wording.
// We rely on the hook to always provide an array (possibly 1–2 points from rollup).

import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

function fmtGBP(v, currency) {
  if (v == null || Number.isNaN(v)) return "—";
  const ccy = currency || "GBP";
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(Number(v));
  } catch {
    return `£${Number(v).toFixed(2)}`;
  }
}

function pickValue(p) {
  if (typeof p?.market === "number") return { v: p.market, k: "market" };
  if (typeof p?.gbp === "number")    return { v: p.gbp,    k: "gbp"    };
  if (typeof p?.mid === "number")    return { v: p.mid,    k: "mid"    };
  if (typeof p?.low === "number")    return { v: p.low,    k: "low"    };
  if (typeof p?.high === "number")   return { v: p.high,   k: "high"   };
  return { v: null, k: null };
}

function RangePill({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function PricingHistory({ history, range, onChangeRange, loading, error }) {
  const rows = Array.isArray(history) ? history : [];
  const latest = rows.length ? rows[rows.length - 1] : null;
  const latestValue = useMemo(() => (latest ? pickValue(latest) : { v: null, k: null }), [latest]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Price history</Text>
        <View style={styles.pills}>
          {["7D", "30D", "90D", "1Y"].map((lbl) => (
            <RangePill key={lbl} label={lbl} active={String(range) === lbl} onPress={() => onChangeRange?.(lbl)} />
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerRow}><ActivityIndicator color={COLORS.accent} /></View>
      ) : error ? (
        <View style={styles.centerRow}>
          <Text style={{ color: COLORS.error, textAlign: "center" }}>
            {typeof error === "string" ? error : "Could not load price history"}
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centerRow}>
          <Text style={{ color: COLORS.textMuted }}>Pricing history is currently being collected</Text>
        </View>
      ) : (
        <>
          <View style={styles.sparklineBox}>
            <Text style={styles.sparklineNote}>
              {rows.length} points • latest: {fmtGBP(latestValue.v, latest?.currency)}
            </Text>
          </View>
          <View style={styles.list}>
            {rows.slice(-6).map((p, idx) => {
              const { v, k } = pickValue(p);
              const date = p._t ? new Date(p._t) : null;
              const ds = date
                ? date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" })
                : (p.updatedAt && String(p.updatedAt)) || "—";
              return (
                <View key={`${p._t || idx}`} style={styles.row}>
                  <Text style={styles.rowDate}>{ds}</Text>
                  <Text style={styles.rowVal}>{fmtGBP(v, p.currency)}</Text>
                  <Text style={styles.rowMeta}>{k || ""}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: COLORS.text, fontWeight: "800" },
  pills: { flexDirection: "row", gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  pillActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  pillTextActive: { color: "#fff" },
  centerRow: { paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  sparklineBox: { height: 56, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 8 },
  sparklineNote: { color: COLORS.textMuted, fontSize: 12 },
  list: { marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  rowDate: { flex: 1, color: COLORS.textMuted, fontSize: 12 },
  rowVal: { color: COLORS.text, fontWeight: "800" },
  rowMeta: { color: COLORS.textMuted, fontSize: 12 },
});
