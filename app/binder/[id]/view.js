// app/binder/[id]/view.js
import { useQuery } from "@apollo/client";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, Text, View } from "react-native";

import BinderGrid from "../../../components/binders/BinderGrid";
import PagePager from "../../../components/binders/PagePager";
import PageHeaderBackSimple from "../../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../../theme/colors";

// GraphQL
import { BinderDocument } from "@sixbyfive/tcg-binder/client";

const { width: SCREEN_W } = Dimensions.get("window");

/* --- templates → rows/cols for page.layout strings --- */
const TEMPLATES = {
  "pocket-9": { rows: 3, cols: 3 },
  "pocket-4": { rows: 2, cols: 2 },
  "pocket-3": { rows: 3, cols: 1 },
  full:       { rows: 1, cols: 1 },
};
const fallbackRC = { rows: 3, cols: 3 };

function rcFromLayoutId(layoutId) {
  return TEMPLATES[layoutId] || fallbackRC;
}

// server slot -> UI slot (read-only)
function toUiSlot(slot) {
  if (!slot) return null;
  const c = slot.card ?? slot.item ?? slot;
  const id = String(c?.id ?? slot?.id ?? "");
  const name = c?.name ?? slot?.name ?? "";
  const image =
    c?.image ??
    c?.thumbnail ??
    c?.thumb ??
    c?.images?.small ??
    c?.images?.thumb ??
    slot?.image ??
    "";
  if (!id && !image) return null;
  return { id, image, label: name };
}

function mapBinderToPagesUI(binder) {
  const pages = Array.isArray(binder?.pages) ? binder.pages : [];
  return pages.map((p, i) => {
    const slots = Array.isArray(p?.slots) ? p.slots : [];
    const layoutId = p?.layout || "pocket-9";
    const { rows, cols } = rcFromLayoutId(layoutId);
    return {
      id: String(p?.id ?? i),
      title: p?.title ?? `Page ${i + 1}`,
      rows, cols,
      slots: slots.map(toUiSlot),
    };
  });
}

export default function BinderViewer() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const binderId = String(id || "");
  const listRef = useRef(null);

  const { data, loading, error } = useQuery(BinderDocument, {
    variables: { id: binderId },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const binder = data?.binder ?? null;
  const name = binder?.name ?? "Binder";

  const pages = useMemo(() => mapBinderToPagesUI(binder), [binder]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    listRef.current?.scrollToIndex?.({ index, animated: true });
  }, [index]);

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    setIndex(i);
  };

  /* -------- render -------- */

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
        <Text style={{ color: COLORS.error, textAlign: "center", marginBottom: 12 }}>
          {error.message}
        </Text>
        <Text onPress={() => router.back()} style={{ color: COLORS.accent, fontWeight: "800" }}>
          Go back
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple
        title={name}
        subtitle={`Page ${index + 1} / ${pages.length || 1}`}
        onBack={() => router.back()}
      />

      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, height: "100%", paddingHorizontal: 12 }}>
              <BinderGrid
                rows={item.rows}
                cols={item.cols}
                slots={item.slots}
                // read-only → no handlers
                onSlotPress={undefined}
                onRemove={undefined}
                onMove={undefined}
                onMoveToPage={undefined}
              />
            </View>
          )}
        />
      </View>

      <PagePager
        pages={pages}
        activeIndex={index}
        onSelectIndex={setIndex}
        onAddPage={undefined}     // read-only
        onDeletePage={undefined}  // read-only
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: COLORS.textMuted, fontWeight: "800" },
});
