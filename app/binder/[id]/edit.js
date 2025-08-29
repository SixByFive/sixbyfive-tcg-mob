// app/binder/[id]/edit.js
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Dimensions, FlatList, View } from "react-native";
import PageHeaderBackSimple from "../../../components/common/PageHeaderBackSimple";
import { COLORS } from "../../../theme/colors";

import BinderGrid from "../../../components/binders/BinderGrid";
import BinderOptionsModal, { DEFAULT_TEMPLATE_ID, TEMPLATES } from "../../../components/binders/BinderOptionsModal";
import HeaderActionButton from "../../../components/binders/HeaderActionButton";
import PagePager from "../../../components/binders/PagePager";

const { width: SCREEN_W } = Dimensions.get("window");

export default function BinderEditor() {
  const { id } = useLocalSearchParams();
  const listRef = useRef(null);

  // UI-only state (wire to backend later)
  const [name, setName] = useState("My Binder");
  const [pages, setPages] = useState([
    { id: "p1", title: "Page 1" },
    { id: "p2", title: "Page 2" },
  ]);
  const [index, setIndex] = useState(0); // current page index
  const [layoutId, setLayoutId] = useState(DEFAULT_TEMPLATE_ID); // GLOBAL layout
  const [optionsOpen, setOptionsOpen] = useState(false);

  // keep FlatList in sync (prevents jumping back to page 1)
  useEffect(() => {
    listRef.current?.scrollToIndex?.({ index, animated: true });
  }, [index]);

  const tpl = useMemo(
    () => TEMPLATES.find((t) => t.id === layoutId) ?? TEMPLATES[0],
    [layoutId]
  );

  // pager: user swiped
  const onMomentumEnd = (e) => {
    const i = Math.round(
      e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
    );
    setIndex(i);
  };

  // page ops
  const addPage = () => {
    const pid = Math.random().toString(36).slice(2, 8);
    const next = [...pages, { id: pid, title: `Page ${pages.length + 1}` }];
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
    setIndex((i) => Math.max(0, i - 1));
  };

  // options modal
  const openOptions = () => setOptionsOpen(true);
  const closeOptions = () => setOptionsOpen(false);
  const saveOptions = ({ name: newName, layoutId: newLayoutId /* cover */ }) => {
    if (newName?.trim()) setName(newName.trim());
    if (newLayoutId) setLayoutId(newLayoutId); // GLOBAL layout change
    setOptionsOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <PageHeaderBackSimple
        title={name}
        subtitle={`Page ${index + 1} / ${pages.length}`}
        right={
          <HeaderActionButton label="Options" onPress={openOptions} />
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
          renderItem={() => (
            <View style={{ width: SCREEN_W, height: "100%", paddingHorizontal: 12 }}>
              <BinderGrid rows={tpl.rows} cols={tpl.cols} />
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

      {/* Options modal (rename, global layout, cover) */}
      <BinderOptionsModal
        visible={optionsOpen}
        initialName={name}
        initialLayoutId={layoutId}
        onClose={closeOptions}
        onSave={saveOptions}
      />
    </View>
  );
}
