// components/collection/CollectionCardTile.js

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import { normalizeImageUrl } from "../../utils/cards";

/* =================== Price helpers (provider-agnostic) =================== */

// Normalize a single row into a consistent shape.
function normalizePriceRow(p) {
  if (!p || typeof p !== "object") return null;
  const provider =
    (p.provider ?? p.source ?? "").toString().toLowerCase() || null;
  const variant =
    (p.variant ?? p.variation ?? "").toString().toLowerCase() || null;

  // Prefer pre-converted GBP if present; otherwise keep mid/market.
  const gbp = Number.isFinite(p?.gbp) ? Number(p.gbp) : null;
  const mid = Number.isFinite(p?.mid)
    ? Number(p.mid)
    : Number.isFinite(p?.market)
      ? Number(p.market)
      : null;

  const low = Number.isFinite(p?.low) ? Number(p.low) : null;
  const high = Number.isFinite(p?.high) ? Number(p.high) : null;
  const currency = p?.currency ?? (gbp != null ? "GBP" : null);
  const updatedAt = p?.updatedAt ?? p?.lastUpdated ?? null;

  return {
    provider,
    variant,
    gbp,
    mid,
    low,
    high,
    currency,
    updatedAt,
    _raw: p,
  };
}

// Fold shapes into an array we can evaluate.
function collectPriceRows(item) {
  const rows = [];
  const a = Array.isArray(item?.prices) ? item.prices : null;
  const b = Array.isArray(item?.pricing) ? item.pricing : null;
  const c =
    item?.priceLatest && !Array.isArray(item.priceLatest)
      ? [item.priceLatest]
      : null;

  if (a) rows.push(...a);
  if (b) rows.push(...b);
  if (c) rows.push(...c);

  return rows.map(normalizePriceRow).filter(Boolean);
}

// Pick a single best overall row:
// 1) Prefer rows that have GBP
// 2) Among those, prefer the most recently updated (by updatedAt)
// 3) Else, take the first available row
function pickBestOverall(rows) {
  if (!rows?.length) return null;
  const gbpRows = rows.filter((r) => typeof r.gbp === "number");
  const list = gbpRows.length ? gbpRows : rows;

  const dated = list.filter((r) => !!r.updatedAt);
  if (dated.length) {
    dated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return dated[0];
  }
  return list[0];
}

/* =================== Lightweight price UI =================== */

function formatMoneyGBP(value) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback if Intl not available in some Android JS engines
    return `£${Number(value).toFixed(2)}`;
  }
}

// Short “time ago” for inline display: just now / 12m / 3h / 2d
function timeAgoShort(dt) {
  const ts = +new Date(dt);
  if (!isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Single-line inline pill with value + updated time.
 *  Example:  £2.99  •  ⏱ 20h
 */
function PricePillInline({ priceRow }) {
  if (!priceRow) {
    return (
      <View style={styles.pricePlaceholder}>
        <Text style={styles.pricePlaceholderText}>No price yet</Text>
      </View>
    );
  }

  const value = typeof priceRow.gbp === "number" ? priceRow.gbp : priceRow.mid;
  if (!Number.isFinite(value)) {
    return (
      <View style={styles.pricePlaceholder}>
        <Text style={styles.pricePlaceholderText}>No price yet</Text>
      </View>
    );
  }

  const updated = priceRow.updatedAt ? timeAgoShort(priceRow.updatedAt) : null;

  return (
    <View
      style={styles.pricePill}
      accessibilityRole="text"
      accessibilityLabel={`Estimated price ${formatMoneyGBP(value)}${updated ? `, updated ${updated} ago` : ""}`}
    >
      <Text style={styles.priceValue}>{formatMoneyGBP(value)}</Text>
      {updated ? <Text style={styles.priceDot}>•</Text> : null}
      {updated ? (
        <View style={styles.timeWrap}>
          <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.timeText}>{updated}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* =================== Component =================== */

export default function CollectionCardTile({
  item = {}, // { id, name, setName, number, image, prices/pricing/priceLatest, _collection? }
  onView, // () => void
  onEdit, // () => void
  onRemove, // () => void
}) {
  // Compute best price once, provider-agnostic.
  const bestPriceRow = useMemo(() => {
    const rows = collectPriceRows(item);
    return pickBestOverall(rows);
  }, [item]);

  const imageUri = normalizeImageUrl(item?.image);
  const qty = Number(item?._collection?.quantity ?? 0) || 0;
  const variation = String(item?._collection?.variation ?? "normal");

  return (
    <View style={styles.card}>
      <Pressable onPress={onView} android_ripple={{ color: "#00000022" }}>
        <View style={styles.cardImageWrap}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.cardImage}
              resizeMode="contain"
            />
          ) : null}

          {/* Owned quantity pill */}
          <View style={styles.qtyPill}>
            <Ionicons
              name="albums"
              size={12}
              color="#fff"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.qtyText}>x{qty}</Text>
          </View>

          {/* Variation tag */}
          <View style={styles.variationPill}>
            <Text style={styles.variationText}>
              {variationLabel(variation)}
            </Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item?.name || "—"}
          </Text>

          <View style={styles.rowBetween}>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item?.setName || "—"}
            </Text>
            <Text style={styles.cardMetaStrong}>#{item?.number ?? "—"}</Text>
          </View>

          {/* Inline price pill */}
          <View style={{ marginTop: 8 }}>
            <PricePillInline priceRow={bestPriceRow} />
          </View>
        </View>
      </Pressable>

      {/* Unified action bar */}
      <View style={styles.actionBarWrap}>
        <ActionGhost icon="eye" color={COLORS.accent} onPress={onView} />
        <ActionGhost
          icon="create-outline"
          color={COLORS.text}
          onPress={onEdit}
        />
        <ActionGhost
          icon="trash-outline"
          color={COLORS.error || "#ff6b6b"}
          onPress={onRemove}
        />
      </View>
    </View>
  );
}

function variationLabel(v) {
  const k = String(v || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (
    k === "reverse" ||
    k === "reverseholo" ||
    k === "reverseholofoil" ||
    k === "rev"
  )
    return "Reverse";
  if (k === "holo" || k === "holofoil" || k === "foil") return "Holo";
  if (k === "normal" || k === "nonholo" || k === "nonfoil") return "Normal";
  return v || "Normal";
}

function ActionGhost({ icon, label, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.8 }]}
      android_ripple={{ color: "#00000022" }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
    >
      <Ionicons
        name={icon}
        size={14}
        color={color}
        style={{ marginRight: 6 }}
      />
      {label ? (
        <Text
          style={[
            styles.ghostLabel,
            { color, fontWeight: label === "View" ? "900" : "800" },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/* =================== Styles =================== */

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    margin: 6,
    overflow: "hidden",
  },
  cardImageWrap: {
    backgroundColor: COLORS.alt,
    aspectRatio: 245 / 337,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cardImage: { ...StyleSheet.absoluteFillObject },

  qtyPill: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "#0e1119dd",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  qtyText: { color: "#fff", fontWeight: "800", fontSize: 11 },

  variationPill: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: "#0e1119",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  variationText: { color: COLORS.text, fontWeight: "800", fontSize: 11 },

  cardInfo: { padding: 8 },
  cardName: { color: COLORS.text, fontSize: 14.5, fontWeight: "700" },
  rowBetween: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    flexShrink: 1,
    marginRight: 8,
  },
  cardMetaStrong: { color: COLORS.text, fontSize: 12, fontWeight: "700" },

  /* ---- Inline price pill ---- */
  pricePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8, // space between value · time
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  priceValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  priceDot: { color: COLORS.textMuted, fontSize: 12, fontWeight: "900" },
  timeWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800" },

  /* Fallback when no price is available */
  pricePlaceholder: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pricePlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  /* Unified action bar container */
  actionBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 8,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },

  /* Ghost actions */
  ghostBtn: {
    flex: 1,
    minHeight: 30,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostLabel: {
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
});
