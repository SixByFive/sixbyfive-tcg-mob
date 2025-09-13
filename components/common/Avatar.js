// components/common/Avatar.js
import React, { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../theme/colors";

/**
 * Props:
 * - name: string                       // used for initials fallback
 * - src: string | { url?: string, uri?: string } | null
 * - size?: number
 * - baseUrl?: string                   // e.g. "https://tcg.sixbyfive.com"
 * - enforceHttps?: boolean             // default true
 */
export default function Avatar({ name, src, size = 72, baseUrl, enforceHttps = true }) {
  const [errored, setErrored] = useState(false);

  const initials = useMemo(() => {
    if (!name) return "U";
    const parts = String(name).trim().split(/\s+/);
    return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
  }, [name]);

  const uri = useMemo(() => {
    let u = null;

    // 1) Accept strings or { url|uri }
    if (typeof src === "string") u = src.trim();
    else if (src && typeof src === "object") u = (src.url || src.uri || "").trim();

    if (!u) return null;

    // 2) Protocol-relative -> https
    if (u.startsWith("//")) u = `https:${u}`;

    // 3) Local URIs (expo image picker / fs)
    if (/^(file|content):\/\//i.test(u)) return u;

    // 4) Already absolute http(s)
    if (/^https?:\/\//i.test(u)) {
      if (enforceHttps && u.startsWith("http://")) {
        return u.replace(/^http:\/\//i, "https://");
      }
      return u;
    }

    // 5) Relative paths ("uploads/..", "/uploads/..")
    const ENV_BASE =
      process.env.EXPO_PUBLIC_ASSET_BASE_URL ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      "";

    const base = (baseUrl || ENV_BASE || "").replace(/\/+$/, "");
    if (!base) return null; // can't resolve without a base

    const path = u.startsWith("/") ? u : `/${u}`;
    return `${base}${path}`;
  }, [src, baseUrl, enforceHttps]);

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
