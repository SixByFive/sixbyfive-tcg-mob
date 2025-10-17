// components/SetLogo.native.js
// Loads set logos from your web frontend via getSetLogo().
// Priority (handled in util): Next.js optimizer → direct asset → null.
// If null or the request fails, we render a monogram fallback tile.

import React, { useMemo, useState } from "react";
import { Image, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";
import { getSetLogo } from "../../utils/setLogos.native";

/**
 * Props
 * - name: string (set display name)
 * - code: string (set code or id)
 * - logo?: string (optional explicit path from API like "/assets/set-logos/151-logo.png")
 * - size?: number (square tile size in px; default 112)
 */
export default function SetLogo({ name, code, logo, size = 112 }) {
  const [failed, setFailed] = useState(false);

  // Ask the resolver for a remote image source.
  const src = useMemo(() => getSetLogo(name, code, logo), [name, code, logo]);
  // if (__DEV__) console.log('SetLogo src:', name, code, src);

  const borderRadius = Math.max(12, Math.round(size * 0.14));
  const pad = Math.round(size * 0.08); // padding around the logo image

  // If we have no src or the image failed to load, render a monogram fallback.
  if (!src || failed) {
    const initials = (name || code || "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => (w?.[0] || "").toUpperCase())
      .join("") || "?";

    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: COLORS.alt,
          borderWidth: 1,
          borderColor: COLORS.border,
          alignItems: "center",
          justifyContent: "center",
        }}
        accessible
        accessibilityLabel={`${name || code || "Unknown"} set`}
      >
        <Text
          style={{
            color: COLORS.textMuted,
            fontWeight: "900",
            fontSize: Math.max(16, Math.round(size * 0.28)),
          }}
        >
          {initials}
        </Text>
      </View>
    );
  }

  // Happy path: show the remote logo image
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        overflow: "hidden",
        backgroundColor: COLORS.alt,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessible
      accessibilityLabel={`${name || (code || "").toUpperCase()} logo`}
    >
      <Image
        source={src}
        resizeMode="contain"
        onError={() => setFailed(true)}
        // Use padding instead of percentage to avoid layout flicker and ensure intrinsic sizing on Android
        style={{ width: size - pad * 2, height: size - pad * 2 }}
      />
    </View>
  );
}
