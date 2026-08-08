// app/binder/[id]/view.js
//
// UPDATED (2026-02-18)
//
// CHANGES:
// - ADD: Persist LAST binder route to SecureStore for Home Hub -> Continue
// - ADD: Persist last viewed page index per binder (resume where you left off)
// - ADD: Restore last viewed page index on mount (clamped to page count)
// - KEEP: Existing schema-safe binder query resolution + owner edit button

import { gql, useQuery } from "@apollo/client"; // CHANGED: import gql for fallback
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store"; // ADD
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import BinderGrid from "../../../components/binders/BinderGrid";
import PagePager from "../../../components/binders/PagePager";
import PageHeaderBackSimple from "../../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../../theme/colors";

// GraphQL
import { BinderDocument, MeDocument } from "../../../graphql/documents";

/* ---------- Home Hub persistence keys (must match home.js strings) ---------- */
const LAST_BINDER_ROUTE_KEY = "sbf_last_binder_route_v1"; // SAME as Home
const LAST_BINDER_PAGE_PREFIX = "sbf_last_binder_page_v1:"; // per-binder: `${prefix}${binderId}`

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

async function setNumberKey(key, value) {
  try {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    await SecureStore.setItemAsync(key, String(n));
  } catch {
    // Non-fatal
  }
}

async function getNumberKey(key, fallback = 0) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}
/* ------------------------------------------------------------------------- */

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
        slots {
          id
          cardId
          position
          quantity
        }
      }
    }
  }
`;

function resolveBinderQuery() {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require("../../../graphql/binders");
    const doc = mod?.BINDER_SAFE;
    if (doc && typeof doc === "object" && doc.kind === "Document") return doc;
  } catch (err) {
    if (__DEV__)
      console.warn(
        "[BinderView] require('../../../graphql/binders') failed:",
        err?.message || err,
      );
  }
  if (
    BinderDocument &&
    typeof BinderDocument === "object" &&
    BinderDocument.kind === "Document"
  ) {
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
  full: { rows: 1, cols: 1 },
};
const fallbackRC = { rows: 3, cols: 3 };

function rcFromLayoutId(layoutId) {
  return TEMPLATES[layoutId] || fallbackRC;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const looksLikeCode = (v) =>
  typeof v === "string" && v.includes("-") && !UUID_RE.test(v);

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
    const rawSlots = Array.isArray(p?.slots) ? p.slots : [];
    const layoutId = p?.layout || "pocket-9";
    const { rows, cols } = rcFromLayoutId(layoutId);
    const total = rows * cols;
    // Build a fixed-size grid (null = empty), placing each card at its saved position
    const grid = Array.from({ length: total }, () => null);
    rawSlots.forEach((raw) => {
      const normalized = toUiSlot(raw);
      if (!normalized) return;
      const pos = Number(raw?.position);
      // position is 1-based on the server
      const preferred =
        Number.isFinite(pos) && pos > 0 ? Math.min(total - 1, pos - 1) : undefined;
      if (preferred != null && grid[preferred] == null) {
        grid[preferred] = normalized;
      } else {
        const fallback = grid.findIndex((cell) => cell == null);
        if (fallback !== -1) grid[fallback] = normalized;
      }
    });
    return {
      id: String(p?.id ?? i),
      title: p?.title ?? `Page ${i + 1}`,
      rows,
      cols,
      slots: grid,
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
    skip: !binderId, // ADD: avoid query with empty id
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

  // ADD: set last binder route as soon as we know binderId
  useEffect(() => {
    if (!binderId) return;
    // This matches your actual route: /binder/[id]/view
    const route = `/binder/${encodeURIComponent(binderId)}/view`;
    setRouteKey(LAST_BINDER_ROUTE_KEY, route);
  }, [binderId]);

  // ADD: restore last page index when pages load
  useEffect(() => {
    if (!binderId) return;
    if (!Array.isArray(pages) || pages.length <= 1) return;

    let cancelled = false;
    (async () => {
      const key = `${LAST_BINDER_PAGE_PREFIX}${binderId}`;
      const saved = await getNumberKey(key, 0);
      const clamped = Math.max(
        0,
        Math.min(pages.length - 1, Math.floor(saved)),
      );
      if (cancelled) return;

      // Only update if different (prevents jitter)
      setIndex((prev) => (prev === clamped ? prev : clamped));

      // Scroll after state update tick
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex?.({ index: clamped, animated: false });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [binderId, pages]);

  // Keep list synced when index changes
  useEffect(() => {
    if (!Array.isArray(pages) || pages.length === 0) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, index));
    if (clamped !== index) {
      setIndex(clamped);
      return;
    }
    listRef.current?.scrollToIndex?.({ index: clamped, animated: true });
  }, [index, pages]);

  // ADD: persist page index per binder (and keep last-binder route fresh)
  useEffect(() => {
    if (!binderId) return;
    const key = `${LAST_BINDER_PAGE_PREFIX}${binderId}`;
    setNumberKey(key, index);

    // Also refresh last-binder route (cheap + keeps it correct)
    const route = `/binder/${encodeURIComponent(binderId)}/view`;
    setRouteKey(LAST_BINDER_ROUTE_KEY, route);
  }, [binderId, index]);

  const onMomentumEnd = (e) => {
    const w = e?.nativeEvent?.layoutMeasurement?.width || SCREEN_W || 1;
    const x = e?.nativeEvent?.contentOffset?.x || 0;
    const i = Math.round(x / w);
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
        <Text
          style={{
            color: COLORS.error,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {error.message}
        </Text>
        <Text
          onPress={() => router.back()}
          style={{ color: COLORS.accent, fontWeight: "800" }}
        >
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
                {
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: COLORS.surface,
                },
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                Edit
              </Text>
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
          getItemLayout={(_, i) => ({
            length: SCREEN_W,
            offset: SCREEN_W * i,
            index: i,
          })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <View
              style={{ width: SCREEN_W, height: "100%", paddingHorizontal: 12 }}
            >
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
