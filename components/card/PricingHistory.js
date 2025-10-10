// components/card/PricingHistory.js

// CHANGED: component can take raw `history` items in the new shape and compute bars/stats itself.
// It still supports the old props (barHeights/avg/min/max) as a fallback.

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

const RANGES = ["7D", "30D", "90D", "1Y"];
const CHART_H = 100; // px

/* ---------------- helpers for new price shape ---------------- */
function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

// Prefer market → gbp → mid → low → high
function pickValue(p) {
  if (!p || typeof p !== "object") return undefined;
  return (
    (isNum(p.market) ? p.market : undefined) ??
    (isNum(p.gbp) ? p.gbp : undefined) ??
    (isNum(p.mid) ? p.mid : undefined) ??
    (isNum(p.low) ? p.low : undefined) ??
    (isNum(p.high) ? p.high : undefined)
  );
}

function toTs(x) {
  if (!x) return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const d = new Date(x);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Build bars & stats from raw history
 * @param {Array<object>} history - items like { updatedAt/date, market/mid/low/high/... }
 * @param {number} points - number of bars to produce
 * @param {string} range - one of RANGES
 */
function buildSeries(history, points, range) {
  const now = Date.now();
  const msByRange = {
    "7D": 7 * 86400000,
    "30D": 30 * 86400000,
    "90D": 90 * 86400000,
    "1Y": 365 * 86400000,
  }[range];

  const windowStart = now - msByRange;

  // 1) Normalize raw rows -> {t, v}
  const rows = (Array.isArray(history) ? history : [])
    .map((r) => {
      const t =
        toTs(r?.updatedAt ?? r?.date ?? r?.timestamp ?? r?.time) ??
        null;
      const v = pickValue(r);
      return t != null && isNum(v) ? { t, v } : null;
    })
    .filter(Boolean)
    .filter((row) => row.t >= windowStart && row.t <= now)
    .sort((a, b) => a.t - b.t);

  if (rows.length === 0) {
    return { bars: [], avg: null, min: null, max: null, hasData: false };
  }

  // 2) Bucket into N segments across the range window; last value in bucket wins
  const bucketSize = msByRange / points;
  const buckets = Array.from({ length: points }, (_, i) => ({
    start: windowStart + i * bucketSize,
    end: windowStart + (i + 1) * bucketSize,
    v: null,
  }));

  let idx = 0;
  for (const r of rows) {
    // advance to bucket containing t
    while (idx < buckets.length && r.t >= buckets[idx].end) idx++;
    if (idx >= buckets.length) break;
    if (r.t >= buckets[idx].start && r.t < buckets[idx].end) {
      buckets[idx].v = r.v; // keep last seen value per bucket
    }
  }

  const values = buckets
    .map((b) => (isNum(b.v) ? b.v : null))
    .filter((v) => v != null);

  if (values.length === 0) {
    return { bars: [], avg: null, min: null, max: null, hasData: false };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  // 3) Build bar heights (keep tiny bars for empty buckets so the chart looks continuous)
  const denom = max - min || 1; // avoid divide-by-zero
  const PAD = 12; // leave some headroom
  const bars = buckets.map((b) => {
    const v = isNum(b.v) ? b.v : null;
    if (v == null) return 4; // a thin bar for missing bucket
    const h = ((v - min) / denom) * (CHART_H - PAD);
    return clamp(Math.round(h) + 2, 2, CHART_H); // ensure visible
  });

  return { bars, avg, min, max, hasData: true };
}

/* ---------------- component ---------------- */

export default function PricingHistory({
  // CHANGED: new prop (optional) — pass raw rows in new shape
  history = null,

  // existing props (kept for backward compatibility)
  barHeights,
  avg,
  min,
  max,

  range,
  onChangeRange,
}) {
  // How many bars to render per range
  const POINTS = useMemo(() => {
    switch (range) {
      case "7D":
        return 20;
      case "30D":
        return 30;
      case "90D":
        return 45;
      case "1Y":
      default:
        return 60;
    }
  }, [range]);

  // Prefer real computed series from `history`; else fallback to provided props
  const series = useMemo(() => {
    if (Array.isArray(history) && history.length) {
      return buildSeries(history, POINTS, range);
    }
    // fallback to old props
    const bars = Array.isArray(barHeights) ? barHeights : [];
    return {
      bars,
      avg: isNum(avg) ? avg : null,
      min: isNum(min) ? min : null,
      max: isNum(max) ? max : null,
      hasData: bars.length > 0,
    };
  }, [history, POINTS, range, barHeights, avg, min, max]);

  const showPlaceholder = !series.hasData;

  return (
    <View style={styles.historyCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.historyTitle}>Pricing history</Text>

        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => onChangeRange(r)}
              style={[
                styles.rangePill,
                r === range && { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
              ]}
            >
              <Text
                style={[
                  styles.rangePillText,
                  r === range && { color: "#fff", fontWeight: "800" },
                ]}
              >
                {r}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.chartWrap}>
        <View style={styles.chartGrid}>
          <View style={[styles.hLine, { top: 0 }]} />
          <View style={[styles.hLine, { top: "50%" }]} />
          <View style={[styles.hLine, { bottom: 0 }]} />
        </View>

        <View style={styles.barsRow}>
          {(series.bars.length ? series.bars : Array.from({ length: POINTS }, () => 6)).map(
            (h, i) => (
              <View key={i} style={[styles.bar, { height: h }]} />
            )
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg</Text>
          <Text style={styles.statValue}>
            {series.avg != null ? `£${series.avg.toFixed(2)}` : "—"}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>High</Text>
          <Text style={styles.statValue}>
            {series.max != null ? `£${series.max.toFixed(2)}` : "—"}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Low</Text>
          <Text style={styles.statValue}>
            {series.min != null ? `£${series.min.toFixed(2)}` : "—"}
          </Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        {showPlaceholder
          ? "Placeholder data shown. Live history coming soon."
          : "Values derived from market/mid/low/high fields."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },

  rangeRow: { flexDirection: "row", gap: 6 },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rangePillText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },

  chartWrap: {
    marginTop: 12,
    height: CHART_H,
    borderRadius: 12,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  chartGrid: { ...StyleSheet.absoluteFillObject },
  hLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  barsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 2,
  },
  bar: {
    width: 4,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: COLORS.accent,
  },

  statsRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, fontWeight: "600" },
  statValue: { color: COLORS.text, fontWeight: "800" },
  disclaimer: { color: COLORS.textMuted, fontSize: 12, marginTop: 8, textAlign: "right" },
});
