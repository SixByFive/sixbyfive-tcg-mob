// components/common/Avatar.js
import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

/**
 * Props:
 * - name: string                                   // used for initials fallback
 * - src: string | { url?: string, uri?: string }   // absolute, relative, or local (file/content/data)
 * - size?: number
 * - baseUrl?: string                               // e.g. "https://tcg.sixbyfive.com" (overrides env)
 * - enforceHttps?: boolean                          // default true (upgrade http→https)
 *
 * Env fallbacks (Expo): EXPO_PUBLIC_ASSET_BASE_URL or EXPO_PUBLIC_API_BASE_URL
 * Add to app config if your backend returns relative paths like "/uploads/...".
 */
export default function Avatar({
  name,
  src,
  size = 72,
  baseUrl,
  enforceHttps = true,
}) {
  const [errored, setErrored] = useState(false);

  const initials = useMemo(() => {
    if (!name) return "U";
    const parts = String(name).trim().split(/\s+/);
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  }, [name]);

  const uri = useMemo(() => {
    // 1) Extract a candidate string from supported shapes
    let u = null;
    if (typeof src === "string") u = src.trim();
    else if (src && typeof src === "object") u = String(src.url || src.uri || "").trim();

    if (!u) return null;

    // 2) Protocol-relative (//cdn.example.com/...) → add https
    if (u.startsWith("//")) u = `https:${u}`;

    // 3) Accept local URIs as-is
    if (/^(file:|content:|data:)/i.test(u)) return u;

    // 4) Upgrade http→https if requested
    if (enforceHttps && /^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, "https://");

    // 5) If already absolute (http/https), we're done
    if (/^https?:\/\//i.test(u)) return u;

    // 6) Resolve relative paths using base (prop > env)
    const base =
      baseUrl ||
      process.env.EXPO_PUBLIC_ASSET_BASE_URL ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      "";

    if (!base) {
      // No base available to resolve a relative path — let the caller see initials fallback
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[Avatar] Relative src provided but no baseUrl/EXPO_PUBLIC_* base configured:", u);
      }
      return null;
    }

    const b = String(base).replace(/\/+$/, ""); // trim trailing slashes
    const p = u.startsWith("/") ? u : `/${u}`;   // ensure leading slash
    return `${b}${p}`;
  }, [src, baseUrl, enforceHttps]);

  // Render image if we have a usable URI and it hasn't errored
  if (uri && !errored) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.alt,
          borderColor: COLORS.border,
          borderWidth: StyleSheet.hairlineWidth,
        }}
        resizeMode="cover"
        onError={() => setErrored(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  // Fallback: initials bubble
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
      accessibilityRole="image"
      accessibilityLabel={name ? `${name} avatar` : "User avatar"}
    >
      <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: size * 0.34 }}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
