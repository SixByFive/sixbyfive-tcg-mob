// components/binders/BinderGrid.js
//
// Wired to binder mutations via useBinderActions when no handlers are provided.
// - If you pass onRemove/onMove/onMoveToPage: presentational only (unchanged behavior).
// - If you DON'T pass them but provide { binderId, pageIndex }:
//     • remove → removeBinderSlot
//     • move   → moveBinderSlot (within the same page)
//     • moveToPage is still delegated (we don't know target page slots here)
// Optimistic UI is applied when self-handling so it feels instant.

import { useQuery } from "@apollo/client";
import { Ionicons } from "@expo/vector-icons";
import { MyCollectionDocument } from "@sixbyfive/tcg-binder/client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  findNodeHandle,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { COLORS } from "../../theme/colors";

// ✅ use your app's toast hook (ToastProvider is app-wide)
import useToast from "../../hooks/useToast";

// 🔌 actions (site/app shared)
import useBinderActions from "../../hooks/useBinderActions";

// --- Helpers for identifying card codes (not DB UUIDs) ---
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const looksLikeCode = (v) => typeof v === "string" && v.includes("-") && !UUID_RE.test(v);

export default function BinderGrid({
  // layout + data
  rows = 3,
  cols = 3,
  slots = [],

  // optional binder context for self-handling
  binderId,            // string | number
  pageIndex,           // number

  // optional external handlers (if provided, we won't call mutations here)
  onSlotPress,
  onRemove,            // (slotIndex)
  onMove,              // (fromIdx, toIdx)
  onMoveToPage,        // (fromIdx, 'prev'|'next')
}) {
  const total = rows * cols;

  // Toast API (from your provider)
  const toast = useToast();
  const showComingSoon = (label) =>
    toast.show(`${label} is coming soon`, { type: "info", duration: 2000 });

  // When the parent does NOT supply handlers but gives binder context,
  // we'll call mutations directly and do optimistic UI locally.
  const canSelfHandle = Boolean(binderId != null && Number.isInteger(pageIndex));
  const usesDefaultHandlers =
    canSelfHandle && !onRemove && !onMove; // moveToPage still delegated

  // Mutations
  const { removeSlot, moveSlot } = useBinderActions();

  // --- Owned set (codes) for "Not owned" overlay ---
  const { data: collData, loading: collLoading, error: collError } = useQuery(MyCollectionDocument, {
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const ownedSet = useMemo(() => {
    // Support edges/nodes or flat arrays
    const raw =
      (collData?.myCollection?.edges?.map((e) => e?.node).filter(Boolean)) ??
      collData?.myCollection ??
      collData?.collection ??
      [];

    const codes = [];
    if (Array.isArray(raw)) {
      for (const row of raw) {
        const code =
          row?.card?.code ??
          row?.code ??
          row?.cardCode ??
          row?.cardId ??
          (looksLikeCode(row?.card?.id) ? row.card.id : undefined);
        if (looksLikeCode(code)) codes.push(String(code));
      }
    }
    return new Set(codes);
  }, [collData]);

  const collectionReady = !collLoading && !collError;

  // Local optimistic copy only when we self-handle
  const [localSlots, setLocalSlots] = useState(slots);
  useEffect(() => {
    if (usesDefaultHandlers) setLocalSlots(slots);
  }, [slots, usesDefaultHandlers]);
  const renderSlots = usesDefaultHandlers ? localSlots : slots;

  // (Notes kept for future; pills are disabled for now)
  const [showNotes] = useState(false);
  const [notes, setNotes] = useState("");

  // Footer stats
  const stats = useMemo(() => {
    let used = 0;
    let notOwned = 0;
    for (const s of renderSlots) {
      if (s) {
        used++;
        const code = String(s.id || "");
        const isNotOwned = collectionReady ? !ownedSet.has(code) : (s?.source === "search" || s?.notOwned === true);
        if (isNotOwned) notOwned++;
      }
    }
    return { used, empty: total - used, notOwned };
  }, [renderSlots, total, ownedSet, collectionReady]);

  // Refs & drag state
  const cellRefs = useRef(Array.from({ length: total }, () => React.createRef()));
  const cellAbsFramesRef = useRef(Array.from({ length: total }, () => null)); // {x,y,w,h}
  const gridAbsRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState({
    active: false, from: -1, over: -1,
    pointerAbsX: 0, pointerAbsY: 0, edge: null,
    preview: null, // {image,label}
  });
  const lastTapRef = useRef(0);
  const gridRef = useRef(null);

  // Measure grid & cells
  const measureGridAbs = () => {
    if (!gridRef.current) return;
    const handle = findNodeHandle(gridRef.current);
    if (!handle) return;
    UIManager.measureInWindow(handle, (x, y, w, h) => {
      gridAbsRef.current = { x, y, w, h };
    });
  };
  const measureCellsAbs = () => {
    for (let i = 0; i < total; i++) {
      const ref = cellRefs.current[i]?.current;
      if (!ref) continue;
      const handle = findNodeHandle(ref);
      if (!handle) continue;
      UIManager.measureInWindow(handle, (x, y, w, h) => {
        cellAbsFramesRef.current[i] = { x, y, w, h };
      });
    }
  };
  const onGridLayout = () => {
    measureGridAbs();
    requestAnimationFrame(measureCellsAbs);
  };

  // Hit-test & edges
  const getIndexAtAbsPoint = (absX, absY) => {
    for (let i = 0; i < total; i++) {
      const f = cellAbsFramesRef.current[i];
      if (!f) continue;
      if (absX >= f.x && absX <= f.x + f.w && absY >= f.y && absY <= f.y + f.h) return i;
    }
    return -1;
  };
  const EDGE_W = 36;
  const whichEdge = (absX) => {
    const { x, w } = gridAbsRef.current;
    if (absX <= x + EDGE_W) return "prev";
    if (absX >= x + w - EDGE_W) return "next";
    return null;
  };

  // PanResponder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => dragging.active,
        onStartShouldSetPanResponderCapture: () => dragging.active,
        onMoveShouldSetPanResponderCapture: () => dragging.active,

        onPanResponderMove: (_evt, gesture) => {
          if (!dragging.active) return;
          const pointerAbsX = gesture.moveX;
          const pointerAbsY = gesture.moveY;
          const overIdx = getIndexAtAbsPoint(pointerAbsX, pointerAbsY);
          const edge = whichEdge(pointerAbsX);
          setDragging((d) => ({ ...d, pointerAbsX, pointerAbsY, over: overIdx, edge }));
        },

        onPanResponderRelease: () => {
          if (!dragging.active) return;
          const { from, over, edge } = dragging;

          if (edge && typeof onMoveToPage === "function" && from !== -1) {
            resetDrag();
            onMoveToPage(from, edge);
            return;
          }
          if (from !== -1 && over !== -1 && over !== from) {
            resetDrag();
            handleMove(from, over);
            return;
          }
          resetDrag();
        },

        onPanResponderTerminate: () => resetDrag(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dragging, onMoveToPage, usesDefaultHandlers, binderId, pageIndex, renderSlots]
  );

  const resetDrag = () =>
    setDragging({
      active: false,
      from: -1,
      over: -1,
      pointerAbsX: 0,
      pointerAbsY: 0,
      edge: null,
      preview: null,
    });

  // Start drag
  const beginDrag = (idx) => (e) => {
    const slot = renderSlots[idx];
    if (!slot) return;

    measureGridAbs();
    requestAnimationFrame(measureCellsAbs);

    setDragging({
      active: true,
      from: idx,
      over: idx,
      pointerAbsX: e.nativeEvent.pageX,
      pointerAbsY: e.nativeEvent.pageY,
      edge: null,
      preview: { image: slot.image, label: slot.label },
    });
  };

  // Press logic
  const onCellPress = (idx) => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    const slot = renderSlots[idx];

    if (slot) {
      if (delta < 250) handleRemove(idx); // double-tap remove
    } else {
      onSlotPress?.(idx); // empty -> open drawer
    }
  };

  // Handlers
  const handleRemove = async (idx) => {
    if (typeof onRemove === "function") {
      onRemove(idx);
      return;
    }
    if (!usesDefaultHandlers) return;

    // optimistic UI
    setLocalSlots((prev) => {
      const next = prev.slice();
      next[idx] = null;
      return next;
    });

    try {
      await removeSlot({ binderId, pageIndex, slotIndex: idx });
    } catch (e) {
      setLocalSlots((prev) => [...slots]); // revert
      if (__DEV__) console.warn("removeSlot failed", e);
    }
  };

  const handleMove = async (fromIdx, toIdx) => {
    if (typeof onMove === "function") {
      onMove(fromIdx, toIdx);
      return;
    }
    if (!usesDefaultHandlers) return;

    // optimistic UI
    setLocalSlots((prev) => {
      const next = prev.slice();
      const tmp = next[fromIdx] ?? null;
      next[fromIdx] = null;
      next[toIdx] = tmp;
      return next;
    });

    try {
      await moveSlot({
        binderId,
        fromPage: pageIndex,
        fromSlot: fromIdx,
        toPage: pageIndex,
        toSlot: toIdx,
      });
    } catch (e) {
      setLocalSlots((prev) => [...slots]); // revert
      if (__DEV__) console.warn("moveSlot failed", e);
    }
  };

  // Preview geometry (grid-local)
  const PREVIEW_W = 100;
  const PREVIEW_H = 140;
  const LIFT_Y = 24;
  const previewLocal = (() => {
    const { x: gx, y: gy } = gridAbsRef.current;
    const left = dragging.pointerAbsX - gx - PREVIEW_W / 2;
    const top = dragging.pointerAbsY - gy - PREVIEW_H + LIFT_Y;
    return { left, top };
  })();

  const isSource = (idx) => dragging.active && dragging.from === idx;
  const isHover = (idx) => dragging.active && dragging.over === idx && idx !== dragging.from;

  // Footer pills are visually disabled but tappable → show a toast.
  const onChipPressSoon = (label) => () => showComingSoon(label);

  return (
    // OUTER WRAP: can stretch; marginBottom keeps clear of pager
    <View style={styles.gridWrap} pointerEvents="box-none">
      {/* INNER PANEL: bordered + shrink-to-fit */}
      <View
        ref={gridRef}
        style={styles.gridPanel}
        {...panResponder.panHandlers}
        onLayout={onGridLayout}
      >
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={styles.gridRow}>
            {Array.from({ length: cols }).map((__, c) => {
              const idx = r * cols + c;
              const slot = renderSlots[idx];
              const code = String(slot?.id || "");
              const showOverlay =
                !!slot &&
                (collectionReady
                  ? !ownedSet.has(code)
                  : (slot?.source === "search" || slot?.notOwned === true));

              return (
                <Pressable
                  // attach ref so we can measure this exact cell in absolute coords
                  ref={cellRefs.current[idx]}
                  key={c}
                  onPress={() => onCellPress(idx)}
                  onLongPress={beginDrag(idx)}
                  delayLongPress={220}
                  style={({ pressed }) => [
                    styles.cell,
                    pressed && !slot && { opacity: 0.92 },
                  ]}
                >
                  <View
                    style={[
                      styles.cellInset,
                      isHover(idx) && styles.cellHover,
                      isSource(idx) && styles.cellDraggingSource,
                    ]}
                  >
                    {slot?.image ? (
                      <>
                        <Image
                          source={{ uri: slot.image }}
                          style={[
                            styles.thumb,
                            isSource(idx) && styles.thumbDraggingSource,
                          ]}
                          resizeMode="contain" // show full card
                        />
                        {showOverlay && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Not owned</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.cellText}>＋</Text>
                        {slot?.label ? (
                          <Text style={styles.cellLabel} numberOfLines={1}>
                            {slot.label}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Edge hints (inside the panel) */}
        {dragging.active && (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.edgeHint,
                styles.edgeLeft,
                dragging.edge === "prev" && styles.edgeActive,
              ]}
            >
              <Text style={styles.edgeText}>Prev</Text>
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.edgeHint,
                styles.edgeRight,
                dragging.edge === "next" && styles.edgeActive,
              ]}
            >
              <Text style={styles.edgeText}>Next</Text>
            </View>
          </>
        )}

        {/* Floating preview (relative to panel) */}
        {dragging.active && dragging.preview?.image && (
          <View
            pointerEvents="none"
            style={[
              styles.previewWrap,
              {
                width: PREVIEW_W,
                height: PREVIEW_H,
                left: previewLocal.left,
                top: previewLocal.top,
              },
            ]}
          >
            <Image source={{ uri: dragging.preview.image }} style={styles.previewImg} />
          </View>
        )}
      </View>

      {/* ===== Footer (fills space below the page) ===== */}
      <View style={styles.footer}>
        {/* Quick stats */}
        <View style={styles.footerStats}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.used}/{total}</Text>
            <Text style={styles.statLabel}>Used</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.empty}</Text>
            <Text style={styles.statLabel}>Empty</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.notOwned}</Text>
            <Text style={styles.statLabel}>Not owned</Text>
          </View>
        </View>

        {/* Quick actions — MATCH COLUMN WIDTHS & visually disabled w/ toast */}
        <View style={styles.footerActions}>
          <Pressable
            style={[styles.chip, styles.chipDisabled]}
            onPress={onChipPressSoon("Auto-arrange")}
          >
            <Ionicons name="grid-outline" size={16} color={COLORS.text} />
            <Text style={styles.chipText}>Auto-arrange</Text>
          </Pressable>

          <Pressable
            style={[styles.chip, styles.chipDisabled]}
            onPress={onChipPressSoon("Clear empty")}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.text} />
            <Text style={styles.chipText}>Clear empty</Text>
          </Pressable>

          <Pressable
            style={[styles.chip, styles.chipDisabled]}
            onPress={onChipPressSoon("Page notes")}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.text} />
            <Text style={styles.chipText}>Page notes</Text>
          </Pressable>
        </View>

        {/* Notes area kept (hidden) for future enablement */}
        {showNotes && (
          <View style={styles.notesBox}>
            <TextInput
              placeholder="Notes for this page…"
              placeholderTextColor={COLORS.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notesInput}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const BOTTOM_PAGER_H = 64;

const styles = StyleSheet.create({
  /* Layout wrappers */
  gridWrap: {
    alignSelf: "stretch",
    marginBottom: BOTTOM_PAGER_H + 8,
  },
  gridPanel: {
    position: "relative",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    alignSelf: "stretch",
  },

  /* Grid & cells */
  gridRow: { flexDirection: "row", gap: 8 },
  cell: { flex: 1, flexBasis: 0 },
  cellInset: {
    width: "100%",
    aspectRatio: 63 / 88, // ≈ Pokémon card shape
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cellHover: {
    borderStyle: "solid",
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  cellDraggingSource: { opacity: 0.25 },

  cellText: { color: COLORS.textMuted, fontSize: 22, fontWeight: "900" },
  cellLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },

  thumb: { width: "100%", height: "100%" },
  thumbDraggingSource: { opacity: 0.0 },

  /* Badges & drag hints */
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(41, 99, 255, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 10.5 },

  edgeHint: {
    position: "absolute",
    top: 8,
    bottom: 8,
    width: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  edgeLeft: { left: 8 },
  edgeRight: { right: 8 },
  edgeActive: {
    backgroundColor: "rgba(41,99,255,0.15)",
    borderColor: "rgba(41,99,255,0.35)",
  },
  edgeText: { color: COLORS.textMuted, fontSize: 10, fontWeight: "800" },

  previewWrap: {
    position: "absolute",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    transform: [{ scale: 1.05 }],
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  previewImg: { width: "100%", height: "100%" },

  /* Footer */
  footer: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  footerStats: {
    flexDirection: "row",
    gap: 8, // match grid gap rhythm
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statNum: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  statLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  footerActions: {
    flexDirection: "row",
    gap: 8, // match grid's 8px column gap
  },

  // pills flex to column widths (same as 3 grid columns)
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipDisabled: { opacity: 0.55 }, // visual disabled state
  chipText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },

  notesBox: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    padding: 8,
    minHeight: 80,
  },
  notesInput: {
    color: COLORS.text,
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: "top",
  },
});
