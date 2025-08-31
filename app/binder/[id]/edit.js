// app/binder/[id]/edit.js

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
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
import PageHeaderBackSimple from "../../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../../theme/colors";

import BinderGrid from "../../../components/binders/BinderGrid";
import AddCardsDrawer from "../../../components/binders/CardsAddDrawer";
import PagePager from "../../../components/binders/PagePager";

// Uses shared modal + constants
import BinderOptionsModal, {
  DEFAULT_TEMPLATE_ID,
  TEMPLATES,
} from "../../../components/binders/BinderOptionsModal";

const { width: SCREEN_W } = Dimensions.get("window");

// UTILS ───────────────────────────────────────────────────────────────────────
const getTemplate = (templateId) =>
  Array.isArray(TEMPLATES)
    ? (TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0])
    : TEMPLATES?.[templateId] || { id: "fallback", rows: 3, cols: 3, name: "3×3" };

// Resize a slots array, preserving existing values left→right,top→bottom
function reshapeSlots(slots, rows, cols) {
  const newSize = Math.max(1, rows * cols);
  return Array.from({ length: newSize }, (_, i) => slots?.[i] || null);
}

export default function BinderEditor() {
  const { id } = useLocalSearchParams();
  const listRef = useRef(null);

  // STATE ─────────────────────────────────────────────────────────────────────
  const [name, setName] = useState("My Binder");

  // Track the chosen template/layout (global across all pages)
  const [templateId, setTemplateId] = useState(
    DEFAULT_TEMPLATE_ID ||
      (Array.isArray(TEMPLATES) ? TEMPLATES[0]?.id : Object.keys(TEMPLATES || {})[0])
  );

  // Template → rows/cols
  const activeTemplate = useMemo(() => getTemplate(templateId), [templateId]);
  const [layout, setLayout] = useState({
    rows: activeTemplate.rows,
    cols: activeTemplate.cols,
  });

  // Initial per-page slots sized to current layout
  const initialSlots = useMemo(
    () => Array.from({ length: layout.rows * layout.cols }, () => null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // seed once at mount; later changes are handled in saveOptions()
  );

  const [pages, setPages] = useState([
    { id: "p1", title: "Page 1", slots: initialSlots },
    { id: "p2", title: "Page 2", slots: initialSlots },
  ]);

  const [index, setIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // MOCK DATA ────────────────────────────────────────────────────────────────
  const MOCK_COLLECTION = [
    { id: "o1", name: "Bulbasaur", image: "https://placehold.co/200x280/png" },
    { id: "o2", name: "Mewtwo", image: "https://placehold.co/200x280/png" },
    { id: "o3", name: "Eevee", image: "https://placehold.co/200x280/png" },
  ];
  const MOCK_SEARCH = [
    { id: "c1", name: "Charizard ex", image: "https://placehold.co/200x280/png" },
    { id: "c2", name: "Lugia V", image: "https://placehold.co/200x280/png" },
    { id: "c3", name: "Pikachu", image: "https://placehold.co/200x280/png" },
  ];
  const OWNED_SET = new Set(MOCK_COLLECTION.map((c) => c.id));

  // EFFECTS ──────────────────────────────────────────────────────────────────
  // Keep FlatList aligned to the selected page
  useEffect(() => {
    listRef.current?.scrollToIndex?.({ index, animated: true });
  }, [index]);

  // DERIVED ──────────────────────────────────────────────────────────────────
  const currentPage = pages[index];
  const totalSlots = layout.rows * layout.cols;
  const slotsLeft = (currentPage?.slots || []).filter((s) => !s).length;

  // HANDLERS ────────────────────────────────────────────────────────────────
  const onSlotPress = () => setDrawerOpen(true);
  const openDrawer = () => setDrawerOpen(true);

  // Options modal open/close
  const openOptions = () => setOptionsOpen(true);
  const closeOptions = () => setOptionsOpen(false);

  // Save from BinderOptionsModal
  // NOTE: if modal returns { name, layoutId } instead, map them here.
  const saveOptions = ({ name: nextName, templateId: nextTemplateId, rows, cols }) => {
    const trimmed = (nextName || "").trim();
    if (trimmed) setName(trimmed);

    let chosenTemplateId =
      nextTemplateId ||
      templateId ||
      (Array.isArray(TEMPLATES) ? TEMPLATES[0]?.id : Object.keys(TEMPLATES || {})[0]);

    const tpl = getTemplate(chosenTemplateId);

    // Allow overriding rows/cols (if modal exposes them), else use template
    let nextRows = Number.isFinite(parseInt(rows, 10)) ? parseInt(rows, 10) : tpl.rows;
    let nextCols = Number.isFinite(parseInt(cols, 10)) ? parseInt(cols, 10) : tpl.cols;

    nextRows = Math.max(1, Math.min(10, nextRows));
    nextCols = Math.max(1, Math.min(10, nextCols));

    const layoutChanged =
      nextRows !== layout.rows || nextCols !== layout.cols || chosenTemplateId !== templateId;

    if (layoutChanged) {
      setTemplateId(chosenTemplateId);
      setLayout({ rows: nextRows, cols: nextCols });

      // Reshape all pages to new size, preserving existing placements
      setPages((prev) =>
        prev.map((p) => ({ ...p, slots: reshapeSlots(p.slots, nextRows, nextCols) }))
      );
    }

    setOptionsOpen(false);
  };

  // Drawer confirm (adds into the current page)
  const handleConfirmAdd = (ids) => {
    if (!ids?.length) return;

    setPages((prev) => {
      const next = [...prev];
      const p = { ...next[index] };
      const slots = [...p.slots];

      for (let id of ids) {
        const empty = slots.findIndex((s) => !s);
        if (empty === -1) break;

        const fromCollection = MOCK_COLLECTION.find((c) => c.id === id);
        const fromSearch = fromCollection ? null : MOCK_SEARCH.find((c) => c.id === id);
        const card = fromCollection || fromSearch;

        slots[empty] = {
          id,
          image: card?.image,
          label: card?.name,
          source: fromSearch ? "search" : "collection",
          notOwned: !!fromSearch,
        };
      }

      p.slots = slots;
      next[index] = p;
      return next;
    });
  };

  // Pager swipe -> update selected page index
  const onMomentumEnd = (e) => {
    const i = Math.round(
      e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
    );
    setIndex(i);
  };

  // PAGE OPS  ─────────────────────────────────────────────────────
  const addPage = () => {
    const pid = Math.random().toString(36).slice(2, 8);
    const newSlots = Array.from({ length: layout.rows * layout.cols }, () => null);
    const next = [...pages, { id: pid, title: `Page ${pages.length + 1}`, slots: newSlots }];

    setPages(next);
    setIndex(next.length - 1);
  };

  const deletePage = () => {
    if (pages.length <= 1) {
      Alert.alert("Needed", "A binder must have at least one page.");
      return;
    }
    const next = pages.filter((_, i) => i !== index);
    setPages(next);
    setIndex((i) => Math.max(0, Math.min(i, next.length - 1)));
  };

  // RENDER ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple
        title={name}
        subtitle={`Page ${index + 1} / ${pages.length}`}
        right={
          <Pressable
            onPress={openDrawer}
            style={({ pressed }) => [styles.hBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.hBtnText}>Add cards</Text>
          </Pressable>
        }
        right2={
          <Pressable
            onPress={openOptions}
            style={({ pressed }) => [styles.hBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="settings-outline" size={18} color={COLORS.text} />          
          </Pressable>
        }
      />

      {/* Fullscreen pager (horizontal) */}
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
                onSlotPress={onSlotPress}
                onRemove={(removeIdx) => {
                  setPages((prev) => {
                    const next = [...prev];
                    const page = { ...next[index] };
                    const s = [...page.slots];
                    s[removeIdx] = null;
                    page.slots = s;
                    next[index] = page;
                    return next;
                  });
                }}
                onMove={(fromIdx, toIdx) => {
                  if (fromIdx === toIdx) return;
                  setPages((prev) => {
                    const next = [...prev];
                    const page = { ...next[index] };
                    const s = [...page.slots];
                    const moving = s[fromIdx];
                    if (!moving) return prev;
                    // MOVE semantics: place on target, clear source
                    s[toIdx] = moving;
                    s[fromIdx] = null;
                    page.slots = s;
                    next[index] = page;
                    return next;
                  });
                }}
                onMoveToPage={(fromIdx, dir) => {
                  setPages((prev) => {
                    const next = [...prev];
                    const srcPage = { ...next[index] };
                    const srcSlots = [...srcPage.slots];
                    const moving = srcSlots[fromIdx];
                    if (!moving) return prev;

                    const targetIndex =
                      dir === "prev" ? Math.max(0, index - 1) : Math.min(next.length - 1, index + 1);
                    if (targetIndex === index) return prev;

                    const dstPage = { ...next[targetIndex] };
                    const dstSlots = [...dstPage.slots];

                    // find first empty slot on destination page
                    const empty = dstSlots.findIndex((s) => !s);
                    if (empty === -1) {
                      // No room; could auto-add a new page here:
                      // const pid = Math.random().toString(36).slice(2, 8);
                      // const newSlots = Array.from({ length: layout.rows * layout.cols }, () => null);
                      // next.push({ id: pid, title: `Page ${next.length + 1}`, slots: newSlots });
                      // next[next.length - 1].slots[0] = moving;
                      // srcSlots[fromIdx] = null;
                      // srcPage.slots = srcSlots;
                      // return next;
                      return prev;
                    }

                    dstSlots[empty] = moving;
                    srcSlots[fromIdx] = null;

                    srcPage.slots = srcSlots;
                    dstPage.slots = dstSlots;

                    next[index] = srcPage;
                    next[targetIndex] = dstPage;

                    return next;
                  });

                  // UX: flip to target page so user sees the result
                  setIndex((i) =>
                    dir === "prev" ? Math.max(0, i - 1) : Math.min(pages.length - 1, i + 1)
                  );
                }}
              />
            </View>
          )}
        />
      </View>

      {/* Bottom pager with + / − */}
      <PagePager
        pages={pages}
        activeIndex={index}
        onSelectIndex={setIndex}
        onAddPage={addPage}
        onDeletePage={deletePage}
      />

      {/* Drawer */}
      <AddCardsDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destination={{
          pageIndex: index,
          pageLabel: `Page ${index + 1}`,
          slotsLeft,
        }}
        onChangeDestination={() => {
          // OPTIONAL: open page picker modal here
        }}
        onConfirmAdd={handleConfirmAdd}
        collection={MOCK_COLLECTION}
        search={MOCK_SEARCH}
        ownedSet={OWNED_SET}
      />

      {/* Options */}
      <BinderOptionsModal
        visible={optionsOpen}
        onClose={closeOptions}
        onSave={saveOptions}
        // If modal expects these names, pass them; otherwise map as needed:
        name={name}
        templateId={templateId}
        rows={layout.rows}
        cols={layout.cols}
        templates={TEMPLATES}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
