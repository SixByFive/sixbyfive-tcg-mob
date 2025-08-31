// components/binders/CardsAddDrawer.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../theme/colors";
import CardSelectableTile from "../card/CardSelectableTile";
import SelectBar from "../common/SelectBar";

export default function AddCardsDrawer({
  visible,
  onClose,
  destination,
  onChangeDestination,
  onConfirmAdd,
  collection = [],
  search = [],
  ownedSet = new Set(),
}) {
  const [tab, setTab] = useState("collection");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());

  const insets = useSafeAreaInsets(); 

  // ---- Anim + Gesture ----
  const translateY = useRef(new Animated.Value(0)).current;
  const THRESHOLD = 120;
  const SHEET_CLOSE_OFFSET = 800;
  const SELECTION_BAR_HEIGHT = 64; // keep in sync with SelectBar feel

  useEffect(() => {
    if (visible) {
      translateY.setValue(40);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
    } else {
      translateY.setValue(0);
    }
  }, [visible, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 5 && Math.abs(g.dx) < 20,
      onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        const dy = Math.max(0, g.dy);
        if (dy > THRESHOLD) {
          Animated.timing(translateY, { toValue: SHEET_CLOSE_OFFSET, duration: 180, useNativeDriver: false })
            .start(() => { translateY.setValue(0); handleCancel(); });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start(),
    })
  ).current;

  const list = useMemo(() => {
    if (tab === "collection") return collection;
    const q = query.trim().toLowerCase();
    return q ? search.filter((c) => (c.name || "").toLowerCase().includes(q)) : search;
  }, [tab, collection, search, query]);

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const clear = () => setSelected(new Set());
  const handleCancel = () => { clear(); onClose?.(); };
  const confirm = () => {
    if (selected.size) onConfirmAdd?.(Array.from(selected));
    clear();
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 0),
              transform: [{ translateY }],
            },
          ]}
        >
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            {/* Grabber with gesture only here (avoids FlatList conflicts) */}
            <View style={styles.grabberHit} {...panResponder.panHandlers}>
              <View style={styles.grabber} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={onChangeDestination} hitSlop={8} style={styles.destBtn}>
                <Text style={styles.destText} numberOfLines={1}>
                  Add to {destination?.pageLabel ?? `Page ${destination?.pageIndex + 1 ?? 1}`}
                  {typeof destination?.slotsLeft === "number" ? ` • ${destination.slotsLeft} slots left` : ""}
                </Text>
              </Pressable>

              <View style={styles.tabs}>
                <TabBtn label="Collection" active={tab === "collection"} onPress={() => setTab("collection")} />
                <TabBtn label="Search" active={tab === "search"} onPress={() => setTab("search")} />
              </View>

              {tab === "search" && (
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search cards…"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                />
              )}
            </View>

            {/* Content */}
            <FlatList
              data={list}
              keyExtractor={(c) => c.id}
              numColumns={2}
              contentContainerStyle={{
                paddingHorizontal: 12,
                // NEW: ensure last row is above the bar + safe area
                paddingBottom: SELECTION_BAR_HEIGHT + insets.bottom + 12,
              }}
              columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 10 }}
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                const notOwned = tab === "search" ? !ownedSet.has(item.id) : false;
                return (
                  <CardSelectableTile
                    card={item}
                    selected={isSelected}
                    notOwned={notOwned}
                    onPress={() => toggle(item.id)}
                    onLongPress={() => toggle(item.id)}
                  />
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.empty}><Text style={styles.emptyText}>
                  {tab === "search" ? "No results." : "No cards in your collection."}
                </Text></View>
              )}
              keyboardShouldPersistTaps="handled"
            />

            {/* Selection bar */}
            <SelectBar
              count={selected.size}
              onAdd={confirm}
              onClear={clear}
              onCancel={handleCancel}
              bottomInset={insets.bottom}                 
              styleOverride={styles.selectBarOverride}    
              fullBleed                                   
            />
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function TabBtn({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const SHEET_HEIGHT = "78%";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: COLORS.border,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0, 
    height: SHEET_HEIGHT,
    overflow: "hidden",
  },

  grabberHit: { paddingTop: 8, paddingBottom: 8, alignItems: "center" },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: COLORS.border },

  header: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 },
  destBtn: {
    backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8,
  },
  destText: { color: COLORS.text, fontWeight: "800" },

  tabs: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.accent },
  tabText: { color: COLORS.text, fontWeight: "800" },
  tabTextActive: { color: "#fff" },

  searchInput: {
    marginTop: 8, backgroundColor: COLORS.alt, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text,
  },

  empty: { alignItems: "center", paddingVertical: 16 },
  emptyText: { color: COLORS.textMuted },

  // thin top border to visually anchor the bar to the sheet
  selectBarOverride: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
});
