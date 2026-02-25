// app/(tabs)/home.js
//
// UPDATED (2026-02-23)
//
// CHANGES:
// - [REMOVE] EvolvedSpotlightBanner import (single partner banner)
// - [ADD] PartnersSpotlightSlider import (new slider)
// - [ADD] Partner slider data with 2 partners (keeps Evolved as one)
// - [ADD] Local fallback hero require for Evolved slide (optional but recommended)
// - [CHG] Replaced <EvolvedSpotlightBanner /> usage with <PartnersSpotlightSlider partners={...} />
//
// NOTE:
// - Second partner uses a placeholder URL + placeholder hero. Replace with real partner details when ready.
// - Slider component expected at: ../../components/partners/PartnersSpotlightSlider
//   (the file I gave you previously)

import { useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { MeDocument } from "@sixbyfive/tcg-binder";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../../theme/colors";

import DiscordCard from "../../components/home/DiscordCard";
import GettingStartedCard from "../../components/home/GettingStartedCard";
import SnapshotCard from "../../components/home/SnapshotCard";
import UserSearchCard from "../../components/home/UserSearchCard";
import VerificationBanner from "../../components/home/VerificationBanner";

// [REMOVED] Single partner banner
// import EvolvedSpotlightBanner from "../../components/partners/EvolvedSpotlightBanner";

// [ADDED] New slider
import PartnersSpotlightSlider from "../../components/partners/PartnersSpotlightSlider";

// [ADDED] Optional: local hero for Evolved slide
// (Keeps you safe if remote image fails / and matches the old local fallback behaviour)
const EVOLVED_HERO = require("../../assets/images/evolved.png");
const LEO_HERO = require("../../assets/images/leos.png");

const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

// Feature switches (hardcoded off for now)
const SHOW_SUBSCRIPTION = false;
const SHOW_PRICE_WATCH = false;

// SecureStore keys (local-only)
const RECENT_USERS_KEY = "sbf_home_recent_user_search_v1";

// "Continue where you left off" keys
export const LAST_BINDER_ROUTE_KEY = "sbf_last_binder_route_v1";
export const LAST_SEARCH_ROUTE_KEY = "sbf_last_search_route_v1";
export const LAST_PROFILE_ROUTE_KEY = "sbf_last_profile_route_v1";

// Helpers
function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function cleanString(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

async function setRouteKey(key, route) {
  const next = cleanString(route);
  if (!next) return;
  try {
    const prev = await SecureStore.getItemAsync(key);
    if (prev === next) return;
    await SecureStore.setItemAsync(key, next);
  } catch {
    // Non-fatal
  }
}

function PillButton({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pillBtn, pressed && { opacity: 0.85 }]}
      hitSlop={8}
    >
      <Text style={styles.pillBtnText}>{label}</Text>
    </Pressable>
  );
}

function MiniRow({ title, subtitle, right }) {
  return (
    <View style={styles.miniRow}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.miniRowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.miniRowSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();

  // UI state
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Local "Continue" routes
  const [lastBinderRoute, setLastBinderRoute] = useState("");
  const [lastSearchRoute, setLastSearchRoute] = useState("");
  const [lastProfileRoute, setLastProfileRoute] = useState("");

  // Snapshot counts lifted up from SnapshotCard (single source of truth)
  const [snapCounts, setSnapCounts] = useState({
    cards: 0,
    binders: 0,
    wishlist: 0,
  });

  const {
    data,
    loading: meLoading,
    refetch,
    networkStatus,
  } = useQuery(MeDocument, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const user = data?.me;

  const greeting = useMemo(() => {
    if (meLoading) return "…";
    return `Hey ${user?.username || "Trainer"} 👋`;
  }, [meLoading, user?.username]);

  const containerPaddingTop = Math.max(12, insets.top + 12);
  const containerPaddingBottom = Math.max(16, insets.bottom + 16);

  const loadLocalRoutes = useCallback(async () => {
    try {
      const [b, s, p] = await Promise.all([
        SecureStore.getItemAsync(LAST_BINDER_ROUTE_KEY),
        SecureStore.getItemAsync(LAST_SEARCH_ROUTE_KEY),
        SecureStore.getItemAsync(LAST_PROFILE_ROUTE_KEY),
      ]);
      setLastBinderRoute(cleanString(b));
      setLastSearchRoute(cleanString(s));
      setLastProfileRoute(cleanString(p));
    } catch {
      setLastBinderRoute("");
      setLastSearchRoute("");
      setLastProfileRoute("");
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
      await loadLocalRoutes();
      // SnapshotCard queries will refresh via cache-and-network automatically.
    } finally {
      setTimeout(() => setRefreshing(false), 250);
    }
  }, [refetch, loadLocalRoutes]);

  // Load persisted recent searches + continue routes on mount
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const rawRecent = await SecureStore.getItemAsync(RECENT_USERS_KEY);
        if (!mounted) return;

        const nextRecent = rawRecent ? safeJsonParse(rawRecent, []) : [];
        const cleanRecent = Array.isArray(nextRecent)
          ? nextRecent.filter((t) => typeof t === "string").slice(0, 5)
          : [];
        setRecent(cleanRecent);

        await loadLocalRoutes();
      } catch {
        if (!mounted) return;
        setRecent([]);
        setLastBinderRoute("");
        setLastSearchRoute("");
        setLastProfileRoute("");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadLocalRoutes]);

  // Persist recent whenever it changes
  useEffect(() => {
    (async () => {
      try {
        await SecureStore.setItemAsync(
          RECENT_USERS_KEY,
          JSON.stringify(recent),
        );
      } catch {
        // Non-fatal
      }
    })();
  }, [recent]);

  const hasAnyContinue =
    !!lastBinderRoute || !!lastSearchRoute || !!lastProfileRoute;

  // Onboarding uses snapshot counts (same logic as SnapshotCard)
  const isNewUser = useMemo(() => {
    const total =
      Number(snapCounts.cards || 0) +
      Number(snapCounts.binders || 0) +
      Number(snapCounts.wishlist || 0);
    return total <= 0 && !hasAnyContinue;
  }, [snapCounts, hasAnyContinue]);

  // [ADDED] Partner slider data (2 partners)
  // - Keeps Evolved as partner #1
  // - Partner #2 is placeholder: replace when you have details
  const partners = useMemo(
    () => [
      {
        id: "evolved",
        partnerName: "Evolved Protection",
        // Keep your exact tagline formatting
        tagline: (
          <Text>
            <Text style={{ fontStyle: "italic" }}>Evolve</Text> the way you
            protect your cards
          </Text>
        ),
        blurb: "Trusted sleeves, toploaders & shields for serious collectors.",
        bullets: ["Sleeves that actually fit", "Toploaders you can trust"],
        ctaLabel: "Shop Evolved",
        ctaHref:
          "https://evolvedcardprotection.co.uk?sca_ref=9820478.MfkcaLj4ToIM",
        heroUri: EVOLVED_HERO, // local require() (safe + consistent)
        partnershipPillText: "In partnership with SixByFive TCG",
      },

      // Partner #2 (placeholder)
      // Replace: partnerName, tagline/blurb, ctaHref, heroUri when you have it.
      {
        id: "leo",
        partnerName: "Leo's Poké Vault",
        tagline: "",
        blurb:
          "Leo's Poké Vault, a family-run store built on a shared love of Pokémon and Trading Card Games!",
        bullets: [""],
        ctaLabel: "Shop Sealed",
        ctaHref: "https://www.leospokevault.co.uk",
        helper:
          "We’re here to help you find the perfect cards, accessories, and supplies",
        heroUri: LEO_HERO,
        partnershipPillText: "In partnership with SixByFive TCG",
      },
    ],
    [],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: containerPaddingTop,
        paddingBottom: containerPaddingBottom,
      }}
      refreshControl={
        <RefreshControl
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
          progressBackgroundColor={COLORS.surface}
          refreshing={refreshing || networkStatus === 4 /* refetching */}
          onRefresh={onRefresh}
        />
      }
    >
      {/* Header (row) */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.h1}>{greeting}</Text>
          <Text style={styles.sub}>
            Track your collection, check prices, and build binders.
          </Text>
        </View>

        {/* NEW: Gear icon -> Settings */}
        <Pressable
          onPress={() => router.push("/settings")}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerIconBtn,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="settings-outline" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      {/* Verify banner */}
      {user && user.emailVerified === false && <VerificationBanner />}

      {/* HUB */}
      <View style={styles.hubCard}>
        <View style={styles.hubHeader}>
          <Text style={styles.hubTitle}>Your hub</Text>
        </View>

        {/* Snapshot INSIDE hub (and also feeds counts up) */}
        <SnapshotCard
          loading={meLoading}
          user={user}
          onCounts={(c) => {
            if (
              c?.cards === snapCounts.cards &&
              c?.binders === snapCounts.binders &&
              c?.wishlist === snapCounts.wishlist
            ) {
              return;
            }
            setSnapCounts({
              cards: Number(c?.cards || 0),
              binders: Number(c?.binders || 0),
              wishlist: Number(c?.wishlist || 0),
            });
          }}
        />

        {/* Dynamic Getting Started (only when truly new) */}
        {!SHOW_SUBSCRIPTION && isNewUser ? (
          <View style={{ marginTop: 6 }}>
            <GettingStartedCard />
          </View>
        ) : null}

        {/* Continue */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.sectionLabel}>Continue</Text>

          {hasAnyContinue ? (
            <View style={styles.continueBox}>
              {!!lastBinderRoute && (
                <MiniRow
                  title="Last binder"
                  subtitle="Open where you left off"
                  right={
                    <PillButton
                      label="Open"
                      onPress={() => router.push(lastBinderRoute)}
                    />
                  }
                />
              )}

              {!!lastSearchRoute && (
                <MiniRow
                  title="Last search"
                  subtitle="Resume card search"
                  right={
                    <PillButton
                      label="Resume"
                      onPress={() => router.push(lastSearchRoute)}
                    />
                  }
                />
              )}

              {!!lastProfileRoute && (
                <MiniRow
                  title="Last profile"
                  subtitle="Go back to that user"
                  right={
                    <PillButton
                      label="View"
                      onPress={() => router.push(lastProfileRoute)}
                    />
                  }
                />
              )}
            </View>
          ) : (
            <Text style={styles.hint}>
              Shortcuts appear here after you open a binder, search cards, or
              view a profile.
            </Text>
          )}
        </View>

        {/* Quick actions */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.sectionLabel}>Quick actions</Text>
          <View style={styles.pillsRow}>
            <PillButton
              label="Create binder"
              onPress={() => router.push("/binder/new")}
            />
            <PillButton
              label="Search cards"
              onPress={() => {
                setRouteKey(LAST_SEARCH_ROUTE_KEY, "/(tabs)/search");
                router.push("/(tabs)/search");
              }}
            />
            <PillButton
              label="Browse sets"
              onPress={() => router.push("/sets")}
            />
            {/* REMOVED: Settings pill (now in header as gear) */}
          </View>
        </View>
      </View>

      {/* Find collectors */}
      <UserSearchCard
        recent={recent}
        onCommitRecent={(term) => {
          const cleaned = cleanString(term);
          if (!cleaned) return;

          setRecent((prev) => {
            const next = [
              cleaned,
              ...prev.filter((t) => t.toLowerCase() !== cleaned.toLowerCase()),
            ];
            return next.slice(0, 5);
          });
        }}
        onClearRecent={() => setRecent([])}
        onSelectUser={(u) => {
          const route = `/profile/${encodeURIComponent(u.username)}`;
          setRouteKey(LAST_PROFILE_ROUTE_KEY, route);
          router.push(route);
        }}
        onToggleFollow={() => {}}
      />

      {/* Discord */}
      <DiscordCard inviteUrl={DISCORD_INVITE} />

      {/* Partner spotlight (SLIDER) */}
      <PartnersSpotlightSlider partners={partners} showDots autoplay={true} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },

  h1: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sub: { color: COLORS.textMuted, marginTop: 6, marginBottom: 14 },

  hubCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  hubHeader: { marginBottom: 8 },
  hubTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },

  sectionLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  hint: { color: COLORS.textMuted, marginTop: 2 },

  continueBox: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: "hidden",
  },

  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  miniRowTitle: { color: COLORS.text, fontWeight: "900" },
  miniRowSub: { color: COLORS.textMuted, marginTop: 2, fontSize: 12 },

  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pillBtn: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pillBtnText: { color: COLORS.text, fontWeight: "900" },
});
