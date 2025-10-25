// app/binder/[id]/index.js
import { useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, Text, View } from "react-native";

import { BINDER_SAFE } from "../../../graphql/binders-temp";
import BinderGrid from "../../../components/binders/BinderGrid";
import PagePager from "../../../components/binders/PagePager";
import PageHeaderBackSimple from "../../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../../theme/colors";

const { width: SCREEN_W } = Dimensions.get("window");

/* ---------- layout helpers ---------- */
const LAYOUT_SIZES = {
  "pocket-9": { rows: 3, cols: 3 },
  "pocket-4": { rows: 2, cols: 2 },
  "pocket-3": { rows: 3, cols: 1 },
  full: { rows: 1, cols: 1 },
};
const sizeFor = (layout) => LAYOUT_SIZES[String(layout || "").toLowerCase()] || { rows: 3, cols: 3 };

/* ---------- slot mapping ---------- */
/* ---------- slot mapping (robust, no bare `card`) ---------- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const looksLikeCode = (v) => typeof v === "string" && v.includes("-") && !UUID_RE.test(v);

/** Server slot → UI slot */
function toUiSlot(slot) {
  if (!slot) return null;
  const rawCode = slot?.cardId ?? (looksLikeCode(slot?.id) ? slot.id : null);
  const code = rawCode ? String(rawCode) : null;
  const id = code || (slot?.id ? String(slot.id) : "");
  if (!id) return null;
  const label = slot?.label || slot?.name || (code ? code.toUpperCase() : "");
  return { id, code, cardId: code, image: "", label };
}

export default function BinderReadOnly() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const binderId = String(id || "");
  const listRef = useRef(null);

  const { data, loading, error } = useQuery(BINDER_SAFE, {
    variables: { id: binderId },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const binder = data?.binder ?? null;
  const pages = Array.isArray(binder?.pages) ? binder.pages : [];

  // Build a readonly UI model per page
  const uiPages = useMemo(
    () =>
      pages.map((p, i) => {
        const sz = sizeFor(p?.layout);
        const slots = (Array.isArray(p?.slots) ? p.slots : []).map(toUiSlot);
        return { id: String(p?.id ?? i), title: p?.title ?? `Page ${i + 1}`, rows: sz.rows, cols: sz.cols, slots };
      }),
    [pages]
  );

  const [index, setIndex] = useState(0);
  useEffect(() => {
    listRef.current?.scrollToIndex?.({ index, animated: true });
  }, [index]);

  if (loading && !binder) {
    return (
      <View style={[styles.centerWrap]}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.centerWrap, { paddingHorizontal: 24 }]}>
        <Text style={{ color: COLORS.error, textAlign: "center", marginBottom: 12 }}>{error.message}</Text>
        <Text onPress={() => router.back()} style={{ color: COLORS.accent, fontWeight: "800" }}>
          Go back
        </Text>
      </View>
    );
  }
  const name = binder?.name ?? "Binder";
  const coverColor = binder?.coverColor || "#23243c";
  const accentColor = binder?.accentColor || "#424a80";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple
        title={name}
        subtitle={`Page ${index + 1} / ${uiPages.length || 1}`}
        onBack={() => router.back()}
        // little cover swatch on the right
        right={
          <View style={styles.coverSwatch}>
            <View style={[styles.coverAccent, { backgroundColor: accentColor }]} />
            <View style={[styles.coverFill, { backgroundColor: coverColor }]} />
          </View>
        }
      />

      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={uiPages}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
            setIndex(i);
          }}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, height: "100%", paddingHorizontal: 12 }}>
              <BinderGrid
                rows={item.rows}
                cols={item.cols}
                slots={item.slots}
                // read-only: do NOT pass any edit handlers
              />
            </View>
          )}
        />
      </View>

      <PagePager pages={uiPages} activeIndex={index} onSelectIndex={setIndex} />
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  loadingText: { color: COLORS.textMuted, fontWeight: "800" },
  coverSwatch: {
    width: 26,
    height: 18,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    overflow: "hidden",
    flexDirection: "row",
  },
  coverAccent: { width: 4 },
  coverFill: { flex: 1 },
});
