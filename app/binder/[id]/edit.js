// app/binder/[id]/edit.js  (BinderEditor)
import { gql, useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import BinderGrid from "../../../components/binders/BinderGrid";
import BinderOptionsModal, {
  DEFAULT_TEMPLATE_ID,
  TEMPLATES,
} from "../../../components/binders/BinderOptionsModal";
import AddCardsDrawer from "../../../components/binders/CardsAddDrawer";
import PagePager from "../../../components/binders/PagePager";
import PageHeaderBackSimple from "../../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../../theme/colors";

// ---------------- GraphQL: FORCE using graphql/binders-temp.js with a hard fallback ----------------

// Minimal, schema-safe fallback (never undefined)
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
        notes
        slots { id cardId position quantity notes }
      }
    }
  }
`;

// Resolve the safe document robustly; never return undefined
function resolveBinderQuery() {
  try {
    // Use require() so we bypass any ESM/CJS interop oddities
    // Path from this file: ../../../graphql/binders
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const safe = require("../../../graphql/binders");
    const doc = safe?.BINDER_SAFE;
    if (doc && typeof doc === "object" && doc.kind === "Document") {
      return doc;
    }
  } catch (err) {
    if (__DEV__) console.warn("[BinderEditor] require('../../../graphql/binders') failed:", err?.message || err);
  }
  if (__DEV__) console.warn("[BinderEditor] Using FALLBACK_BINDER_SAFE (temp module missing or invalid export)");
  return FALLBACK_BINDER_SAFE;
}

const BINDER_QUERY = resolveBinderQuery();

// ---------------- Shared actions ----------------
import useBinderActions from "../../../hooks/useBinderActions";

const { width: SCREEN_W } = Dimensions.get("window");

const getTemplate = (templateId) =>
  Array.isArray(TEMPLATES)
    ? TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0]
    : TEMPLATES?.[templateId] || { id: "fallback", rows: 3, cols: 3, name: "3×3" };

function inferTemplateId(rows, cols) {
  const hit =
    (Array.isArray(TEMPLATES) &&
      TEMPLATES.find((t) => Number(t.rows) === Number(rows) && Number(t.cols) === Number(cols))) ||
    null;
  return hit?.id || DEFAULT_TEMPLATE_ID || "pocket-9";
}

// server slot -> UI slot
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const looksLikeCode = (v) => typeof v === "string" && v.includes("-") && !UUID_RE.test(v);

// Preserve the raw slot.id as _slotId so server moves can resolve by ID
function toUiSlot(slot, searchHints) {
  if (!slot) return null;
  const rawCode = slot?.cardId ?? (looksLikeCode(slot?.id) ? slot.id : null);
  const code = rawCode ? String(rawCode) : null;
  if (!code) return null;
  const label = slot?.label || slot?.name || code.toUpperCase();
  const fromSearch = Boolean(searchHints?.has(code));
  const image = "";
  return {
    id: slot?.id ? String(slot.id) : code,       // UI id
    _slotId: slot?.id ? String(slot.id) : undefined, // <- persist original slot id for server
    cardId: code,
    code,
    image,
    label,
    ...(fromSearch ? { source: "search", notOwned: true } : {}),
  };
}

function placeSlot(grid, slot, preferredIdx) {
  if (!Array.isArray(grid) || !grid.length || !slot) return;
  const total = grid.length;
  const inBounds =
    typeof preferredIdx === "number" && preferredIdx >= 0 && preferredIdx < total
      ? preferredIdx
      : undefined;
  if (inBounds != null && grid[inBounds] == null) {
    grid[inBounds] = slot;
    return;
  }
  const fallback = grid.findIndex((cell) => cell == null);
  if (fallback !== -1) grid[fallback] = slot;
}

function mapBinderToPagesUI(binder, totalSlots, searchHints) {
  const pages = Array.isArray(binder?.pages) ? binder.pages : [];
  const size = Math.max(1, totalSlots || 0);

  return pages.map((p, i) => {
    const rawSlots = Array.isArray(p?.slots) ? p.slots : [];
    const grid = Array.from({ length: size }, () => null);

    rawSlots.forEach((raw) => {
      const normalized = toUiSlot(raw, searchHints);
      if (!normalized) return;
      const pos = Number(raw?.position);
      const preferred =
        Number.isFinite(pos) && pos > 0 ? Math.min(size - 1, pos - 1) : undefined;
      placeSlot(grid, normalized, preferred);
    });

    return {
      id: String(p?.id ?? i),
      rawId: p?.id ? String(p.id) : undefined,
      title: p?.title ?? `Page ${i + 1}`,
      notes: p?.notes ?? "",
      slots: grid,
    };
  });
}

export default function BinderEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  // guard against array param
  const binderId = String(Array.isArray(id) ? id[0] : id || "");
  const listRef = useRef(null);

  const {
    addPage: addPageServer,
    addCard: addCardServer,
    moveSlot: moveSlotServer,
    removeSlot: removeSlotServer,
    savePages: savePagesServer,
    updateBinder: updateBinderServer,
    deleteBinder: deleteBinderServer,
  } = useBinderActions();

  // Query binder — BINDER_QUERY is guaranteed to be a DocumentNode now
  const { data, loading, error } = useQuery(BINDER_QUERY, {
    variables: { id: binderId },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const binder = data?.binder ?? null;

  // UI state
  const [name, setName] = useState("My Binder");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [layout, setLayout] = useState({ rows: 3, cols: 3 });
  const [pendingSlotIndex, setPendingSlotIndex] = useState(null);
  const [searchAddedCodes, setSearchAddedCodes] = useState(() => new Set());

  const totalSlots = Math.max(1, Number(layout.rows || 0) * Number(layout.cols || 0));

  const pages = useMemo(() => {
    const mapped = mapBinderToPagesUI(binder, totalSlots, searchAddedCodes);
    if (mapped.length) return mapped;
    return [
      {
        id: "temp-0",
        title: "Page 1",
        slots: Array.from({ length: totalSlots }, () => null),
      },
    ];
  }, [binder, totalSlots, searchAddedCodes]);
  const [index, setIndex] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    listRef.current?.scrollToIndex?.({ index, animated: true });
  }, [index]);

  useEffect(() => {
    setSearchAddedCodes(new Set());
    setPendingSlotIndex(null);
  }, [binderId]);

  // hydrate from server
  useEffect(() => {
    if (!binder) return;
    const nextName = binder.name || "My Binder";
    const templateHint = binder?.layoutId ?? binder?.templateId ?? binder?.pages?.[0]?.layout;
    const tpl = getTemplate(templateHint || DEFAULT_TEMPLATE_ID);
    const rows = Number(binder?.layout?.rows ?? binder?.rows ?? tpl?.rows ?? 3) || 3;
    const cols = Number(binder?.layout?.cols ?? binder?.cols ?? tpl?.cols ?? 3) || 3;

    setName(nextName);
    setLayout({ rows, cols });
    setTemplateId(binder?.layoutId ?? binder?.templateId ?? inferTemplateId(rows, cols));

    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, (pages?.length || 1) - 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binder?.id, binder?.name, binder?.layout, binder?.pages?.length]);

  const currentPage = pages[index] || { slots: Array.from({ length: totalSlots }, () => null) };
  const slotsRemaining = (currentPage?.slots || []).reduce(
    (acc, slot) => acc + (slot ? 0 : 1),
    0
  );

  /* ---------------- handlers ---------------- */

  const openOptions = () => setOptionsOpen(true);
  const openDrawer = (slotIdx = null) => {
    setPendingSlotIndex(typeof slotIdx === "number" && slotIdx >= 0 ? slotIdx : null);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setPendingSlotIndex(null);
  };

  // Add cards -> fill first empty slots (local walk). We pass real card codes.
  const handleConfirmAdd = async (ids, meta = {}) => {
    if (!binderId || !Array.isArray(ids) || !ids.length) return;
    if (meta?.source === "search") {
      setSearchAddedCodes((prev) => {
        const next = new Set(prev);
        let changed = false;
        ids.forEach((raw) => {
          const code = raw ? String(raw) : null;
          if (code && !next.has(code)) {
            next.add(code);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    // local working copy for "find next empty"
    const working = Array.from({ length: totalSlots }, (_, i) => currentPage?.slots?.[i] ?? null);
    const findNextEmpty = (startAt = 0) => {
      for (let i = startAt; i < totalSlots; i++) if (!working[i]) return i;
      return -1;
    };

    const preferredStart =
      typeof pendingSlotIndex === "number" && pendingSlotIndex >= 0 ? pendingSlotIndex : 0;
    let nextIdx = findNextEmpty(preferredStart);
    if (nextIdx === -1) nextIdx = findNextEmpty(0);

    const currentPageId = currentPage?.rawId ?? null;

    for (const cardId of ids) {
      if (nextIdx === -1) break;
      try {
        await addCardServer({
          ...(currentPageId
            ? { pageId: currentPageId, position: nextIdx, binderId }
            : { binderId, pageIndex: index, slotIndex: nextIdx }),
          cardId,
        });
        // mark locally so subsequent picks skip this slot
        working[nextIdx] = { id: `local-${cardId}` };
      } catch (e) {
        console.warn("addCard failed", e);
      }
      nextIdx = findNextEmpty(nextIdx + 1);
    }

    closeDrawer();
  };

  // Move within current page: send indexes + IDs + explicit 1-based position
  const handleMoveWithin = async (fromIdx, toIdx) => {
    if (!binderId || fromIdx === toIdx) return;
    try {
      const page = pages[index];
      const fromSlot = page?.slots?.[fromIdx];
      await moveSlotServer({
        binderId,
        // index-based (legacy)
        fromPage: index,
        fromSlot: fromIdx,
        toPage: index,
        toSlot: toIdx,
        // id-based (robust)
        fromPageId: page?.rawId,
        toPageId: page?.rawId,
        fromSlotId: fromSlot?._slotId,
        position: toIdx + 1, // explicit destination position (1-based)
      });
    } catch (e) {
      console.warn("moveSlot (within) failed", e);
    }
  };

  // Move across pages: send destination pageId + explicit 1-based position
  const handleMoveToPage = async (fromIdx, dir) => {
    if (!binderId) return;

    let targetIndex =
      dir === "prev" ? Math.max(0, index - 1) : Math.min((pages?.length ?? 1) - 1, index + 1);

    // If dragging to next on last page → create a page first
    if (dir === "next" && index === (pages?.length ?? 1) - 1) {
      try {
        const updated = await addPageServer(binderId);
        targetIndex = Math.max(0, (updated?.pages?.length ?? (pages?.length ?? 0)) - 1);
        setIndex(targetIndex);
      } catch (e) {
        console.warn("addPage (edge move) failed", e);
        return;
      }
    } else {
      setIndex(targetIndex);
    }

    // find first empty slot on destination, using our current snapshot
    const srcPage = pages[index] || { slots: [] };
    const destPage = pages[targetIndex] || { slots: [] };
    const empty = (destPage.slots || []).findIndex((s) => !s);
    if (empty === -1) return;

    try {
      const fromSlot = srcPage?.slots?.[fromIdx];
      await moveSlotServer({
        binderId,
        // index-based
        fromPage: index,
        fromSlot: fromIdx,
        toPage: targetIndex,
        toSlot: empty,
        // id-based (robust)
        fromPageId: srcPage?.rawId,
        toPageId: destPage?.rawId,
        fromSlotId: fromSlot?._slotId,
        position: empty + 1, // explicit 1-based destination
      });
    } catch (e) {
      console.warn("moveSlot (across pages) failed", e);
    }
  };

  const handleRemove = async (slotIdx) => {
    if (!binderId) return;
    const slot = pages[index]?.slots?.[slotIdx];
    const codeToDrop = slot?.cardId || slot?.code;
    try {
      await removeSlotServer({ binderId, pageIndex: index, slotIndex: slotIdx });
      if (codeToDrop) {
        setSearchAddedCodes((prev) => {
          if (!prev.has(codeToDrop)) return prev;
          const next = new Set(prev);
          next.delete(codeToDrop);
          return next;
        });
      }
    } catch (e) {
      console.warn("removeSlot failed", e);
    }
  };

  // Build a save-pages payload from raw cache data, with per-page overrides
  const buildPagesPayload = useCallback((overrides = {}) => {
    const rawPages = Array.isArray(data?.binder?.pages) ? data.binder.pages : [];
    return rawPages.map((p, i) => ({
      id: String(p.id),
      title: p?.title ?? `Page ${i + 1}`,
      layout: p?.layout || "pocket-9",
      pageOrder: i,
      notes: overrides[i]?.notes !== undefined ? overrides[i].notes : (p?.notes || ""),
      slots: (overrides[i]?.slots ?? (Array.isArray(p?.slots) ? p.slots : []))
        .filter((s) => s?.cardId)
        .map((s, pos) => ({
          ...(s?.id ? { id: String(s.id) } : {}),
          cardId: String(s.cardId),
          position: pos + 1,
          quantity: Number.isFinite(s?.quantity) ? Number(s.quantity) : 1,
          ...(s?.notes ? { notes: s.notes } : {}),
        })),
    }));
  }, [data]);

  const handleAutoArrange = useCallback(async (pageIdx) => {
    const rawPage = data?.binder?.pages?.[pageIdx];
    if (!rawPage) return;
    const sorted = (rawPage.slots || [])
      .filter((s) => s?.cardId)
      .sort((a, b) => (a.cardId || "").localeCompare(b.cardId || ""));
    try {
      await savePagesServer(binderId, buildPagesPayload({ [pageIdx]: { slots: sorted } }));
    } catch (e) {
      Alert.alert("Auto-arrange failed", e?.message || "Could not arrange page.");
    }
  }, [data, binderId, savePagesServer, buildPagesPayload]);

  const handleClearEmpty = useCallback(async (pageIdx) => {
    const rawPage = data?.binder?.pages?.[pageIdx];
    if (!rawPage) return;
    const compacted = (rawPage.slots || []).filter((s) => s?.cardId);
    try {
      await savePagesServer(binderId, buildPagesPayload({ [pageIdx]: { slots: compacted } }));
    } catch (e) {
      Alert.alert("Clear empty failed", e?.message || "Could not compact page.");
    }
  }, [data, binderId, savePagesServer, buildPagesPayload]);

  const handleNotesChange = useCallback(async (notes, pageIdx) => {
    try {
      await savePagesServer(binderId, buildPagesPayload({ [pageIdx]: { notes } }));
    } catch (e) {
      console.warn("saveNotes failed", e);
    }
  }, [binderId, savePagesServer, buildPagesPayload]);

  const handleChangeDestination = useCallback(() => {
    const options = pages.map((p, i) => ({
      text: p.title || `Page ${i + 1}`,
      onPress: () => setIndex(i),
    }));
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Select page", "Add cards to which page?", options);
  }, [pages]);

  // Options modal → update name/rows/cols/cover
  const saveOptions = async ({ name: nextName, layoutId: nextLayoutId, cover, rows, cols }) => {
    try {
      let r = rows, c = cols;
      if (!(Number.isFinite(r) && Number.isFinite(c))) {
        const tpl = getTemplate(nextLayoutId || templateId);
        r = tpl.rows; c = tpl.cols;
      }

      const updated = await updateBinderServer({
        binderId,
        name: (nextName || "").trim(),
        rows: r,
        cols: c,
        cover,
      });

      if (updated?.name) setName(updated.name);
      const newRows = Number(updated?.layout?.rows ?? r) || r;
      const newCols = Number(updated?.layout?.cols ?? c) || c;
      setLayout({ rows: newRows, cols: newCols });
      setTemplateId(inferTemplateId(newRows, newCols));
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update binder options.");
    } finally {
      setOptionsOpen(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete binder",
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setOptionsOpen(false);
              await deleteBinderServer(binderId);
              router.back();
            } catch (e) {
              Alert.alert("Delete failed", e?.message || "Could not delete binder.");
            }
          },
        },
      ]
    );
  };

  const onMomentumEnd = (e) => {
    const i = Math.round(
      e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
    );
    setIndex(i);
  };

  const addPage = async () => {
    if (!binderId) return;
    try {
      const updated = await addPageServer(binderId);
      const last = Math.max(0, (updated?.pages?.length ?? 1) - 1);
      setIndex(last);
    } catch (e) {
      Alert.alert("Add page failed", e?.message || "Could not add a new page.");
    }
  };

  const deletePage = async () => {
    if (!binderId) return;
    if ((pages?.length || 1) <= 1) {
      Alert.alert("Can't remove page", "A binder must have at least one page.");
      return;
    }
    try {
      // Build a new pages array without the current page, renumber pageOrder, keep layout/titles
      const binderFromCache = data?.binder;
      const rawPages = Array.isArray(binderFromCache?.pages) ? binderFromCache.pages : [];
      const keep = rawPages.filter((_, i) => i !== index);

      const payload = keep.map((p, i) => ({
        id: String(p.id),
        title: p?.title ?? `Page ${i + 1}`,
        layout: p?.layout || "pocket-9",
        pageOrder: i,
        slots: (Array.isArray(p?.slots) ? p.slots : [])
          .filter(Boolean)
          .map((s, pos) => {
            const codeRaw =
              (typeof s?.cardId === "string" && s.cardId.trim()) ||
              (looksLikeCode(s?.id) ? String(s.id) : "");
            if (!codeRaw) return null;
            const code = String(codeRaw);
            return {
              ...(s?.id ? { id: String(s.id) } : {}),
              cardId: code,
              position: Number(s?.position) || pos + 1, // 1-based
              quantity: Number.isFinite(s?.quantity) ? Number(s.quantity) : 1,
              ...(s?.notes ? { notes: s.notes } : {}),
            };
          })
          .filter(Boolean),
      }));

      const updated = await savePagesServer(binderId, payload);
      setIndex((i) => Math.max(0, Math.min(i, (updated?.pages?.length || 1) - 1)));
    } catch (e) {
      Alert.alert("Remove page failed", e?.message || "Could not remove page.");
    }
  };

  /* ---------------- render ---------------- */

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
          <Pressable onPress={() => openDrawer(null)} style={({ pressed }) => [styles.hBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.hBtnText}>Add cards</Text>
          </Pressable>
        }
        right2={
          <Pressable onPress={openOptions} style={({ pressed }) => [styles.hBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="settings-outline" size={18} color={COLORS.text} />
          </Pressable>
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
          renderItem={({ item, index: pageListIdx }) => (
            <View style={{ width: SCREEN_W, height: "100%", paddingHorizontal: 12 }}>
              <BinderGrid
                rows={layout.rows}
                cols={layout.cols}
                slots={item.slots}
                notes={item.notes}
                onSlotPress={(slotIdx) => openDrawer(slotIdx)}
                onRemove={handleRemove}
                onMove={handleMoveWithin}
                onMoveToPage={handleMoveToPage}
                onAutoArrange={() => handleAutoArrange(pageListIdx)}
                onClearEmpty={() => handleClearEmpty(pageListIdx)}
                onNotesChange={(n) => handleNotesChange(n, pageListIdx)}
              />
            </View>
          )}
        />
      </View>

      <PagePager
        pages={pages}
        activeIndex={index}
        onSelectIndex={setIndex}
        onAddPage={addPage}
        onDeletePage={deletePage}
      />

      <AddCardsDrawer
        visible={drawerOpen}
        onClose={closeDrawer}
        destination={{ pageIndex: index, pageLabel: `Page ${index + 1}`, slotIndex: pendingSlotIndex, slotsLeft: slotsRemaining }}
        onChangeDestination={handleChangeDestination}
        onConfirmAdd={handleConfirmAdd}
      />

      <BinderOptionsModal
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onSave={saveOptions}
        onDelete={handleDelete}
        initialName={name}
        initialLayoutId={templateId}
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
  hBtn: {
    backgroundColor: COLORS.alt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hBtnText: { color: COLORS.text, fontWeight: "800" },
});
