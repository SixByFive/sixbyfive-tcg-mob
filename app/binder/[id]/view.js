// app/binder/[id]/view.js
import { gql, useQuery } from "@apollo/client"; // CHANGED: import gql for fallback
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import BinderGrid from "../../../components/binders/BinderGrid";
import PagePager from "../../../components/binders/PagePager";
import PageHeaderBackSimple from "../../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../../theme/colors";

// GraphQL
import { BinderDocument, MeDocument } from "@sixbyfive/tcg-binder/client";

/* ---------- GraphQL: robust resolver with inline fallback ---------- */
const FALLBACK_BINDER_SAFE = gql`
  query Binder_Safe_Fallback($id: ID!) {
    binder(id: $id) {
      id
      name
      coverColor
      accentColor
      pages {
        id
        title
        pageOrder
        layout
        slots { id cardId position quantity }
      }
    }
  }
`;

function resolveBinderQuery() {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require("../../../graphql/binders-temp");
    const doc = mod?.BINDER_SAFE;
    if (doc && typeof doc === "object" && doc.kind === "Document") return doc;
  } catch (err) {
    if (__DEV__) console.warn("[BinderView] require('../../../graphql/binders-temp') failed:", err?.message || err);
  }
  if (BinderDocument && typeof BinderDocument === "object" && BinderDocument.kind === "Document") {
    return BinderDocument;
  }
  if (__DEV__) console.warn("[BinderView] Using FALLBACK_BINDER_SAFE");
  return FALLBACK_BINDER_SAFE;
}

const BINDER_QUERY = resolveBinderQuery();
/* ------------------------------------------------------------------ */

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const looksLikeCode = (v) => typeof v === "string" && v.includes("-") && !UUID_RE.test(v);

function toUiSlot(slot) {
  if (!slot) return null;
  const rawCode = slot?.cardId ?? (looksLikeCode(slot?.id) ? slot.id : null);
  const code = rawCode ? String(rawCode) : null;
  if (!code) return null;
  const id = code || (slot?.id ? String(slot.id) : "");
  const label = slot?.label || slot?.name || code.toUpperCase();
  return { id, code, cardId: code, image: "", label };
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
  const binderId = String(Array.isArray(id) ? id[0] : id || "");
  const listRef = useRef(null);

  // who am I? (for owner check)
  const { data: meData } = useQuery(MeDocument, { fetchPolicy: "cache-first" });
  const meId = meData?.me?.id ? String(meData.me.id) : null;

  const { data, loading, error } = useQuery(BINDER_QUERY, {
    variables: { id: binderId },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const binder = data?.binder ?? null;
  const name = binder?.name ?? "Binder";

  // owner detection (supports binder.userId or binder.user.id)
  const ownerId =
    (binder?.userId != null ? String(binder.userId) : null) ||
    (binder?.user?.id ? String(binder.user.id) : null);
  const isOwner = !!meId && !!ownerId && meId === ownerId;

  const pages = useMemo(() => mapBinderToPagesUI(binder), [binder]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    listRef.current?.scrollToIndex?.({ index, animated: true });
  }, [index]);

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    setIndex(i);
  };

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
        right={
          isOwner ? (
            <Pressable
              onPress={() => router.push(`/binder/${binderId}/edit`)}
              style={({ pressed }) => [
                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: COLORS.surface },
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.text, fontWeight: "800" }}>Edit</Text>
            </Pressable>
          ) : null
        }
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
        onAddPage={undefined}
        onDeletePage={undefined}
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
