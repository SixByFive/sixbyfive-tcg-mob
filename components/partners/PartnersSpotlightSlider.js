// components/partners/PartnersSpotlightSlider.js

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
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
  if (typeof input === "string" && /^https?:\/\//i.test(input))
    return { uri: input };
  return fallback;
}

// [ADD] Normalize optional string fields so "" or "   " becomes null
function normalizeTextMaybeEmpty(v) {
  if (typeof v !== "string") return v; // could be ReactNode, null, undefined
  const s = v.trim();
  return s.length ? s : null;
}

// Small helper to safely open URLs
async function safeOpenUrl(url) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
  } catch {
    // swallow
  }
}

export default function PartnersSpotlightSlider({
  partners = [],
  style = null,

  // UI options
  showDots = true,
  autoplay = false,
  autoplayMs = 6500,
  initialIndex = 0,

  // Copy that you might want consistent across partners
  // [CHG] You can set defaultHelper="" to remove helper text globally
  defaultHelper = "Protect your cards while you show off your collection.",
  partnershipPillText = "In partnership with SixByFive TCG",
}) {
  const listRef = useRef(null);

  // Measure available width from parent (e.g. ScrollView padding)
  const [containerW, setContainerW] = useState(0);

  // Prevent autoplay fighting manual swipes
  const isDraggingRef = useRef(false);

  // Normalized partner list (ensures stable ids + fallbacks)
  const slides = useMemo(() => {
    const safe = Array.isArray(partners) ? partners : [];

    return safe.filter(Boolean).map((p, idx) => {
      const id = p.id || p.partnerName || `partner_${idx}`;

      // [CHG] Tagline can be truly omitted now
      const tagline = normalizeTextMaybeEmpty(p.tagline);

      // [CHG] Helper is optional:
      // - If partner specifies helper (even ""), we respect it.
      // - Otherwise we use defaultHelper (which you can set to "").
      const helper = Object.prototype.hasOwnProperty.call(p, "helper")
        ? normalizeTextMaybeEmpty(p.helper)
        : normalizeTextMaybeEmpty(defaultHelper);

      return {
        id: String(id),
        partnerName: p.partnerName || "Partner",
        tagline, // may be null OR ReactNode OR string
        blurb: normalizeTextMaybeEmpty(p.blurb) || "",
        bullets: Array.isArray(p.bullets) ? p.bullets : [""], // kept for compatibility
        ctaLabel: p.ctaLabel || "Learn more",
        ctaHref: p.ctaHref || "",
        heroUri: p.heroUri ?? FALLBACK_HERO,
        onCtaPress: typeof p.onCtaPress === "function" ? p.onCtaPress : null,
        helper, // may be null (so it won't render)
        partnershipPillText:
          normalizeTextMaybeEmpty(p.partnershipPillText) || partnershipPillText,
      };
    });
  }, [partners, defaultHelper, partnershipPillText]);

  const [activeIndex, setActiveIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(slides.length - 1, 0)),
  );

  // Keep activeIndex in range if partners change
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  // Card width uses measured container width (fallback to 280 if not measured yet)
  const cardWidth = useMemo(() => {
    const w = Number(containerW || 0);
    return Math.max(280, w || 280);
  }, [containerW]);

  // Autoplay (optional)
  useEffect(() => {
    if (!autoplay) return;
    if (slides.length <= 1) return;
    if (!cardWidth || cardWidth <= 0) return;

    const t = setInterval(
      () => {
        if (isDraggingRef.current) return;

        setActiveIndex((prev) => {
          const next = (prev + 1) % slides.length;
          try {
            listRef.current?.scrollToOffset({
              offset: next * cardWidth,
              animated: true,
            });
          } catch {}
          return next;
        });
      },
      Math.max(2500, autoplayMs),
    );

    return () => clearInterval(t);
  }, [autoplay, autoplayMs, slides.length, cardWidth]);

  const onMomentumEnd = useCallback(
    (e) => {
      const x = e?.nativeEvent?.contentOffset?.x ?? 0;
      const idx = Math.round(x / cardWidth);
      const clamped = Math.min(
        Math.max(idx, 0),
        Math.max(slides.length - 1, 0),
      );
      setActiveIndex(clamped);
    },
    [cardWidth, slides.length],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const heroSource = normalizeImageSource(item.heroUri, FALLBACK_HERO);

      const handlePressCta = async () => {
        try {
          item.onCtaPress?.(item);
        } catch {}
        await safeOpenUrl(item.ctaHref);
      };

      // [CHG] Tagline only renders if provided (no fallback)
      const hasTagline = !!item.tagline;

      // [CHG] Helper only renders if non-empty
      const hasHelper = !!item.helper;

      return (
        <View style={[styles.slideOuter, { width: cardWidth }]}>
          <View
            style={styles.card}
            accessibilityLabel={`${item.partnerName} spotlight banner`}
          >
            {/* HERO */}
            <ImageBackground
              source={heroSource}
              style={styles.hero}
              imageStyle={styles.heroImg}
              resizeMode="cover"
              accessible
              accessibilityLabel={`${item.partnerName} hero`}
            >
              <View style={styles.heroOverlay} />
            </ImageBackground>

            <View style={styles.divider} />

            {/* BODY */}
            <View style={styles.body}>
              {/* [FIX] Conditionally render tagline so no blank space */}
              {hasTagline && (
                <Text style={styles.tagline} numberOfLines={2}>
                  {item.tagline}
                </Text>
              )}

              {!!item.blurb && (
                <Text
                  // [CHG] If no tagline, remove the extra "marginTop" look by using a tighter margin
                  style={[styles.blurb, !hasTagline && styles.blurbNoTagline]}
                  numberOfLines={2}
                >
                  {item.blurb}
                </Text>
              )}

              {hasHelper && (
                <Text style={styles.helper} numberOfLines={2}>
                  {item.helper}
                </Text>
              )}

              {/* CTA + Inline Pill */}
              <View style={styles.ctaRow}>
                <Pressable
                  onPress={handlePressCta}
                  android_ripple={{ color: "#00000022" }}
                  style={({ pressed }) => [
                    styles.cta,
                    pressed && styles.ctaPressed,
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.ctaLabel} at ${item.partnerName}`}
                >
                  <Text style={styles.ctaText}>{item.ctaLabel}</Text>
                </Pressable>

                <View style={styles.badgeInline}>
                  <Text style={styles.badgeInlineText} numberOfLines={1}>
                    {item.partnershipPillText}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [cardWidth],
  );

  // Empty state (safe)
  if (!slides.length) {
    return (
      <View style={[styles.emptyWrap, style]}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Partners</Text>
          <Text style={styles.emptyText}>
            No partner spotlights yet. Add items to the{" "}
            <Text style={styles.mono}>partners</Text> array to show them here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width ?? 0;
        if (!w) return;
        if (Math.abs(w - containerW) < 1) return;
        setContainerW(w);

        // snap to current index after first measure
        try {
          listRef.current?.scrollToOffset({
            offset: activeIndex * w,
            animated: false,
          });
        } catch {}
      }}
    >
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        snapToInterval={cardWidth}
        decelerationRate={Platform.OS === "ios" ? "fast" : 0.92}
        bounces={slides.length > 1}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: cardWidth * index,
          index,
        })}
        initialScrollIndex={Math.min(
          Math.max(initialIndex, 0),
          Math.max(slides.length - 1, 0),
        )}
        onScrollToIndexFailed={() => {}}
        onScrollBeginDrag={() => {
          isDraggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 250);
        }}
      />

      {showDots && slides.length > 1 && (
        <View
          style={styles.dotsRow}
          accessibilityLabel="Partner slider pagination"
        >
          {slides.map((_, i) => (
            <View
              key={`dot_${i}`}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginBottom: 12,
  },

  listContent: {},

  slideOuter: {
    paddingRight: 0,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    width: "100%",
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

  blurb: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    marginTop: 4,
  },
  // [ADD] When there is no tagline, remove the “gap feel”
  blurbNoTagline: {
    marginTop: 0,
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
    flexWrap: "wrap",
  },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    marginRight: 8,
    marginBottom: 6,
  },
  ctaPressed: { opacity: 0.94 },
  ctaText: { color: "#fff", fontWeight: "800" },

  badgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
    maxWidth: "100%",
  },
  badgeInlineText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    includeFontPadding: false,
  },

  /* Dots */
  dotsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: 18,
  },

  /* Empty state */
  emptyWrap: {
    width: "100%",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
});
