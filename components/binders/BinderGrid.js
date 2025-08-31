// components/binders/BinderGrid.js

import React, { useMemo, useRef, useState } from "react";
import {
  findNodeHandle,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { COLORS } from "../../theme/colors";

export default function BinderGrid({
  rows = 3,
  cols = 3,
  slots = [],
  onSlotPress,
  onRemove,
  onMove,         // (fromIdx, toIdx)
  onMoveToPage,   // (fromIdx, 'prev'|'next')
}) {
  const total = rows * cols;

  // Each cell gets a ref so we can measure it in absolute coords
  const cellRefs = useRef(Array.from({ length: total }, () => React.createRef()));
  const cellAbsFramesRef = useRef(Array.from({ length: total }, () => null)); // {x,y,w,h} absolute

  // Grid absolute rect (for edge hot-zones + preview positioning)
  const gridAbsRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const [dragging, setDragging] = useState({
    active: false,
    from: -1,
    over: -1,
    pointerAbsX: 0,
    pointerAbsY: 0,
    edge: null,              // 'prev'|'next'|null
    preview: null,           // { image, label }
  });

  const lastTapRef = useRef(0);
  const gridRef = useRef(null);

  // Measure grid and cells in absolute coords
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

  // Call both on layout and at drag start to ensure fresh positions
  const onGridLayout = () => {
    measureGridAbs();
    // Defer cell measurement to next frame to ensure children laid out
    requestAnimationFrame(measureCellsAbs);
  };

  // Absolute hit-test against per-cell absolute frames
  const getIndexAtAbsPoint = (absX, absY) => {
    for (let i = 0; i < total; i++) {
      const f = cellAbsFramesRef.current[i];
      if (!f) continue;
      if (absX >= f.x && absX <= f.x + f.w && absY >= f.y && absY <= f.y + f.h) return i;
    }
    return -1;
  };

  // Edge hot-zones for page moves
  const EDGE_W = 36;
  const whichEdge = (absX) => {
    const { x, w } = gridAbsRef.current;
    if (absX <= x + EDGE_W) return "prev";
    if (absX >= x + w - EDGE_W) return "next";
    return null;
  };

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
          if (from !== -1 && over !== -1 && over !== from && onMove) {
            resetDrag();
            onMove(from, over);     // MOVE semantics in parent
            return;
          }
          resetDrag();
        },

        onPanResponderTerminate: () => resetDrag(),
      }),
    [dragging, onMove, onMoveToPage]
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

  // Start drag: re-measure grid + cells so frames are current
  const beginDrag = (idx) => (e) => {
    const slot = slots[idx];
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

  const onCellPress = (idx) => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    const slot = slots[idx];

    if (slot) {
      if (delta < 250) onRemove?.(idx); // double-tap remove
    } else {
      onSlotPress?.(idx); // empty -> open drawer
    }
  };

  // Preview geometry (grid-local position for visual; hit-test stays absolute)
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

  return (
    <View
      ref={gridRef}
      style={styles.gridCard}
      {...panResponder.panHandlers}
      onLayout={onGridLayout}
    >
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={styles.gridRow}>
          {Array.from({ length: cols }).map((__, c) => {
            const idx = r * cols + c;
            const slot = slots[idx];
            const showOverlay = !!slot && (slot.source === "search" || slot.notOwned === true);

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
                // onLayout still fires, but we now rely on absolute measure
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
                        resizeMode="cover"
                      />
                      {showOverlay && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>From search</Text>
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

      {/* Edge hints (optional) */}
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

      {/* Floating preview (positioned relative to grid) */}
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
  );
}

const BOTTOM_PAGER_H = 64;

const styles = StyleSheet.create({
  gridCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: BOTTOM_PAGER_H + 8,
  },
  gridRow: { flexDirection: "row", gap: 8, flex: 1 },
  cell: { flex: 1, flexBasis: 0 },
  cellInset: {
    flex: 1,
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
  thumbDraggingSource: { opacity: 0.0 },
  cellText: { color: COLORS.textMuted, fontSize: 22, fontWeight: "900" },
  cellLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  thumb: { width: "100%", height: "100%" },

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
});
