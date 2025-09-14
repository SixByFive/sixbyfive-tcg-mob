import { useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

// GraphQL
import { BinderDocument } from "@sixbyfive/tcg-binder/client";

// Shared actions
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
  return pages.map((p, i) => ({
    id: String(p?.id ?? i),
    title: p?.title ?? `Page ${i + 1}`,
    slots: (Array.isArray(p?.slots) ? p.slots : []).map(toUiSlot),
  }));
}

export default function BinderEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const binderId = String(id || "");
  const listRef = useRef(null);

  const {
    addPage: addPageServer,
    addCard: addCardServer,
    moveSlot: moveSlotServer,
    removeSlot: removeSlotServer,
    savePages: savePagesServer,
    updateBinder: updateBinderServer,
  } = useBinderActions();

  // Query binder
  const { data, loading, error } = useQuery(BinderDocument, {
    variables: { id: binderId },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const binder = data?.binder ?? null;

  // UI state
  const [name, setName] = useState("My Binder");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [layout, setLayout] = useState({ rows: 3, cols: 3 });

  const pages = useMemo(() => mapBinderToPagesUI(binder), [binder]);
  const [index, setIndex] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    listRef.current?.scrollToIndex?.({ index, animated: true });
  }, [index]);

  // hydrate from server
  useEffect(() => {
    if (!binder) return;
    const nextName = binder.name || "My Binder";
    const rows = Number(binder?.layout?.rows ?? binder?.rows ?? 3) || 3;
    const cols = Number(binder?.layout?.cols ?? binder?.cols ?? 3) || 3;

    setName(nextName);
    setLayout({ rows, cols });
    setTemplateId(binder?.layoutId ?? binder?.templateId ?? inferTemplateId(rows, cols));

    setIndex((i) => Math.max(0, Math.min(i, Math.max(0, (pages?.length || 1) - 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binder?.id, binder?.name, binder?.layout, binder?.pages?.length]);

  const currentPage = pages[index] || { slots: [] };
  const totalSlots = layout.rows * layout.cols;

  /* ---------------- handlers ---------------- */

  const openOptions = () => setOptionsOpen(true);

  // Add cards -> fill first empty slots (local walk). We pass real card codes.
  const handleConfirmAdd = async (ids /*, meta */) => {
    if (!binderId || !Array.isArray(ids) || !ids.length) return;

    // local working copy for “find next empty”
    const working = Array.from(currentPage?.slots || []);
    const findNextEmpty = (startAt = 0) => {
      for (let i = startAt; i < totalSlots; i++) if (!working[i]) return i;
      return -1;
    };

    let nextIdx = findNextEmpty(0);

    for (const cardId of ids) {
      if (nextIdx === -1) break;
      try {
        await addCardServer({
          binderId,
          pageIndex: index,
          slotIndex: nextIdx,      // 0-based; actions convert to 1-based for bulk save
          cardId,                  // must be the card code (e.g. "sv05-052")
        });
        // mark locally so subsequent picks skip this slot
        working[nextIdx] = { id: `local-${cardId}` };
      } catch (e) {
        console.warn("addCard failed", e);
      }
      nextIdx = findNextEmpty(nextIdx + 1);
    }

    setDrawerOpen(false);
  };

  const handleMoveWithin = async (fromIdx, toIdx) => {
    if (!binderId || fromIdx === toIdx) return;
    try {
      await moveSlotServer({
        binderId,
        fromPage: index,
        fromSlot: fromIdx,
        toPage: index,
        toSlot: toIdx, // action turns into position = toIdx + 1
      });
    } catch (e) {
      console.warn("moveSlot (within) failed", e);
    }
  };

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
    const destUi = pages[targetIndex] || { slots: [] };
    const empty = (destUi.slots || []).findIndex((s) => !s);
    if (empty === -1) return;

    try {
      await moveSlotServer({
        binderId,
        fromPage: index,
        fromSlot: fromIdx,
        toPage: targetIndex,
        toSlot: empty, // converts to 1-based inside action
      });
    } catch (e) {
      console.warn("moveSlot (across pages) failed", e);
    }
  };

  const handleRemove = async (slotIdx) => {
    if (!binderId) return;
    try {
      await removeSlotServer({ binderId, pageIndex: index, slotIndex: slotIdx });
    } catch (e) {
      console.warn("removeSlot failed", e);
    }
  };

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
            const c = s?.card ?? s;
            const code =
              c?.id && typeof c.id === "string" && c.id.includes("-")
                ? c.id
                : s?.cardId && String(s.cardId).includes("-")
                ? String(s.cardId)
                : s?.card?.code || s?.cardCode || s?.code || "";
            if (!code) return null;
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
          <Pressable onPress={() => setDrawerOpen(true)} style={({ pressed }) => [styles.hBtn, pressed && { opacity: 0.85 }]}>
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
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, height: "100%", paddingHorizontal: 12 }}>
              <BinderGrid
                rows={layout.rows}
                cols={layout.cols}
                slots={item.slots}
                onSlotPress={() => setDrawerOpen(true)}
                onRemove={handleRemove}
                onMove={handleMoveWithin}
                onMoveToPage={handleMoveToPage}
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
        onClose={() => setDrawerOpen(false)}
        destination={{ pageIndex: index, pageLabel: `Page ${index + 1}` }}
        onChangeDestination={() => {}}
        onConfirmAdd={handleConfirmAdd}
      />

      <BinderOptionsModal
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onSave={saveOptions}
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
