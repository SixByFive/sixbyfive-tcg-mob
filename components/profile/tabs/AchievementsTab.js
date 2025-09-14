import { useQuery } from "@apollo/client";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COLORS } from "../../../theme/colors";

import { ACHIEVEMENT_ICONS, DEFAULT_ACHIEVEMENT_ICON } from "../../../assets/achievements";
import { GET_USER_ACHIEVEMENTS } from "../../../graphql/GetUserAchievements.query";

/* ---------------- utils ---------------- */
function formatDate(ts) {
   if (!ts) return "";
   const d = new Date(Number(ts));
   const day = String(d.getDate()).padStart(2, "0");
   const month = String(d.getMonth() + 1).padStart(2, "0");
   const year = String(d.getFullYear()).slice(-2);
   return `${day}/${month}/${year}`;
 }

// Tier palette & styling helpers
const TIER_COLORS = {
  gold:   "#FFD54A",
  silver: "#C9CED6",
  bronze: "#C08A5A",
  default: COLORS.accent, // fallback to brand accent
};

function getTierColor(tier) {
  return TIER_COLORS[(tier || "").toLowerCase()] || TIER_COLORS.default;
}

/* --------------- component --------------- */
export default function AchievementsTab({
  userId,
  items,
  hideWhenEmpty = false,
  showEmptyText = true,
  debug = false,
}) {
  const shouldFetch = !items && !!userId;

  const { data, loading, error, networkStatus } = useQuery(GET_USER_ACHIEVEMENTS, {
    variables: { userId },
    skip: !shouldFetch,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
    errorPolicy: "all",
  });

  const resolvedItems = useMemo(() => {
    const src = Array.isArray(items) ? items : (data?.userAchievements ?? []);
    return src
      .map((ua) => {
        const a = ua?.achievement;
        if (!a) return null;

        const localIcon =
          (a.code && ACHIEVEMENT_ICONS[a.code]) ||
          DEFAULT_ACHIEVEMENT_ICON ||
          ACHIEVEMENT_ICONS.pre_signup;

        return {
          ...ua,
          achievement: {
            ...a,
            icon: localIcon,
          },
        };
      })
      .filter(Boolean);
  }, [items, data]);

  if (!loading && !error && hideWhenEmpty && resolvedItems.length === 0) {
    return null;
  }

  const missingUserIdAndNoItems = !userId && !items;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Achievements</Text>
      </View>

      {debug && (
        <Text style={styles.meta}>
          debug → userId:{String(userId)} • shouldFetch:{String(shouldFetch)} •
          loading:{String(loading)} • items:{resolvedItems.length} •
          networkStatus:{networkStatus} • error:{error ? String(error.message || error) : "none"}
        </Text>
      )}

      {missingUserIdAndNoItems ? (
        <Text style={styles.bodyText}>No userId provided and no items passed in.</Text>
      ) : loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.bodyText}>Loading achievements…</Text>
        </View>
      ) : error ? (
        <Text style={styles.bodyText}>Couldn’t load achievements.</Text>
      ) : resolvedItems.length ? (
        <View style={{ gap: 10 }}>
          {resolvedItems.map((ua, i) => {
            const a = ua.achievement;
            const tierColor = getTierColor(a.tier);

            return (
              <View key={ua.id || a.id || i} style={styles.row}>
                {/* Badge with tier-coloured ring */}
                <View style={[styles.badgeWrap, { borderColor: tierColor }]}>
                  <Image source={a.icon} style={styles.badgeImg} resizeMode="cover" />
                </View>

                {/* Text block */}
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.titleLine}>
                    <Text style={styles.achTitle}>{a.name}</Text>
                    {/* Tier pill (no code shown) */}
                    {!!a.tier && (
                      <View style={[styles.tierPill, { backgroundColor: tierColor + "22", borderColor: tierColor }]}>
                        <Text style={[styles.tierPillText, { color: tierColor }]}>
                          {(a.tier || "").toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {!!a.description && (
                    <Text style={styles.achDesc} numberOfLines={2}>
                      {a.description}
                    </Text>
                  )}

                  {!!ua.earnedAt && (
                    <Text style={styles.meta}>Earned {formatDate(ua.earnedAt)}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : showEmptyText ? (
        <Text style={styles.bodyText}>No achievements yet.</Text>
      ) : null}

      {/* NEW: footer note — always shown under the section */}
      <Text style={styles.footerNote}>More achievements coming soon.</Text>
    </View>
  );
}

/* --------------- styles --------------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    flex: 1,
  },
  countPill: {
    minWidth: 28,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countPillText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },
  bodyText: { color: COLORS.text },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },

  // Bigger badge with tier-coloured ring
  badgeWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.alt,
  },
  badgeImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  achTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  achDesc: { color: COLORS.textMuted, fontSize: 12 },
  meta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  // Tier pill
  tierPill: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tierPillText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },

  // NEW: footer note styling
  footerNote: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
});
