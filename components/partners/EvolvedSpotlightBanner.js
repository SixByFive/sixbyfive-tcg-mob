// components/partners/EvolvedSpotlightBanner.js
// NO LOGO banner — local image fixed + PARTNER PILL MOVED NEXT TO CTA.
//
// CHANGES in this version:
// - [CHG] Removed the badge from the hero overlay.
// - [ADD] Inline pill placed to the RIGHT of the CTA button inside the ctaRow.
// - [ADD] badgeInline style (subtle pill) + minor spacing tweaks.
// - [KEEP] Local image require() + remote URL normalization, same API, same layout.

import React, { useMemo } from "react";
import {
    ImageBackground,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { COLORS } from "../../theme/colors";

// Local asset must be require() and use a supported format (png/jpg/webp)
const FALLBACK_HERO = require("../../assets/images/evolved.png");

// Accept either a local require() (number) or an https URL string
function normalizeImageSource(input, fallback) {
  if (typeof input === "number") return input; // require()
  if (typeof input === "string" && /^https?:\/\//i.test(input)) return { uri: input };
  return fallback;
}

export default function EvolvedSpotlightBanner({
  partnerName = "Evolved Protection",
  tagline,
  blurb = "Trusted sleeves, toploaders & shields for serious collectors.",
  bullets = [""], // kept for API compatibility (not rendered)
  ctaLabel = "Shop Evolved",
  ctaHref = "https://evolvedtrading.co.uk",
  heroUri = FALLBACK_HERO, // can be require() or https URL
  onCtaPress = null,
  style = null,
}) {
  const taglineNode = useMemo(
    () =>
      tagline ?? (
        <>
          <Text style={styles.em}>Evolve</Text> the way you protect your cards.
        </>
      ),
    [tagline]
  );

  const handlePressCta = async () => {
    try {
      onCtaPress?.();
    } catch {}
    if (typeof ctaHref === "string" && /^https?:\/\//i.test(ctaHref)) {
      try {
        const ok = await Linking.canOpenURL(ctaHref);
        if (ok) await Linking.openURL(ctaHref);
      } catch {}
    }
  };

  const heroSource = normalizeImageSource(heroUri, FALLBACK_HERO);

  return (
    <View style={[styles.card, style]} accessibilityLabel={`${partnerName} spotlight banner`}>
      {/* HERO (clean—no badge overlay) */}
      <ImageBackground
        source={heroSource}
        style={styles.hero}
        imageStyle={styles.heroImg}
        resizeMode="cover"
        accessible
        accessibilityLabel={`${partnerName} hero`}
      >
        <View style={styles.heroOverlay} />
      </ImageBackground>

      <View style={styles.divider} />

      {/* BODY */}
      <View style={styles.body}>
        <Text style={styles.tagline} numberOfLines={2}>
          {taglineNode}
        </Text>

        {!!blurb && (
          <Text style={styles.blurb} numberOfLines={2}>
            {blurb}
          </Text>
        )}

        <Text style={styles.helper} numberOfLines={2}>
          Protect your cards while you show off your collection.
        </Text>

        {/* CTA + Inline Pill */}
        <View style={styles.ctaRow}>
          <Pressable
            onPress={handlePressCta}
            android_ripple={{ color: "#00000022" }}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`${ctaLabel} at ${partnerName}`}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>

          <View style={styles.badgeInline}>
            <Text style={styles.badgeInlineText}>In partnership with SixByFive TCG</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    width: "100%",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
    }),
  },

  hero: {
    width: "100%",
    height: 120,
    backgroundColor: COLORS.alt,
    position: "relative",
  },
  heroImg: { width: "100%", height: "100%" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.10)",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },

  body: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  tagline: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    includeFontPadding: false,
    marginTop: 2,
  },
  em: { fontStyle: "italic" },

  blurb: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    marginTop: 4,
  },

  helper: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    marginTop: 6,
    marginBottom: 10,
  },

  /* CTA + Inline Pill */
  ctaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap", // allows pill to wrap below on narrow screens
  },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    marginRight: 8, // space before pill
    marginBottom: 6,
  },
  ctaPressed: { opacity: 0.94 },
  ctaText: { color: "#fff", fontWeight: "800" },

  // Subtle inline pill to the right of the button
  badgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)", // light translucent pill
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
  },
  badgeInlineText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
  },
});
