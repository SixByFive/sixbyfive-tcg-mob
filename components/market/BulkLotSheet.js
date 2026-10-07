// components/market/BulkLotSheet.js
//
// Sell a bulk lot — one listing for a whole set of cards shipped as a single
// parcel. Two modes mirror the web app:
//   TRACKED : multi-select from the seller's collection; backend gets exact cardIds
//   RANDOM  : seller declares count + description + guaranteed inclusions + lot photo
//
// Companion to CreateListingSheet (single card). This sheet is independent —
// no shared state with the single-card flow.

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApolloClient, useMutation } from "@apollo/client";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../../theme/colors";
import {
  MyCollectionForListingDocument,
  MyMarketListingsDocument,
  CreateBulkLotDocument,
} from "../../graphql/documents";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = ["M", "NM", "LP", "MP", "HP", "DMG"];
const PARCEL_SIZES = [
  { value: "LARGE_LETTER", label: "Large Letter" },
  { value: "SMALL_PARCEL",  label: "Small Parcel" },
  { value: "MEDIUM_PARCEL", label: "Medium Parcel" },
];
const MIN_CARD_COUNT = 50;

function conditionRank(c) {
  const i = CONDITIONS.indexOf(c);
  return i === -1 ? 99 : i;
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function Chip({ active, onPress, children, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        active && styles.chipActive,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {children}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ children, optional }) {
  return (
    <Text style={styles.sectionLabel}>
      {children}
      {optional ? <Text style={styles.optional}>  (optional)</Text> : null}
    </Text>
  );
}

// ─── Guaranteed inclusions editor ─────────────────────────────────────────────

function InclusionsEditor({ items, onChange }) {
  function update(i, patch) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function add() { onChange([...items, { description: "", quantity: 1 }]); }
  function remove(i) { onChange(items.filter((_, idx) => idx !== i)); }

  return (
    <View style={{ gap: 8 }}>
      {items.map((it, i) => (
        <View key={i} style={styles.inclusionRow}>
          <TextInput
            value={it.description}
            onChangeText={(v) => update(i, { description: v })}
            placeholder="e.g. 5 holos guaranteed"
            placeholderTextColor={COLORS.textMuted}
            style={[styles.input, { flex: 1 }]}
          />
          <TextInput
            value={String(it.quantity)}
            onChangeText={(v) => update(i, { quantity: Math.max(1, parseInt(v, 10) || 1) })}
            keyboardType="number-pad"
            style={[styles.input, { width: 56, textAlign: "center" }]}
          />
          <Pressable onPress={() => remove(i)} hitSlop={8}>
            <Text style={{ color: COLORS.danger, fontSize: 16, paddingHorizontal: 4 }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={add}>
        <Text style={styles.addLink}>+ Add guarantee</Text>
      </Pressable>
    </View>
  );
}

// ─── Tracked picker (multi-select from collection) ────────────────────────────

function TrackedPicker({ collection, loading, selected, onChange }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collection;
    return collection.filter((e) =>
      (e.card?.name || "").toLowerCase().includes(q)
      || (e.card?.set?.name || "").toLowerCase().includes(q)
    );
  }, [collection, search]);

  function keyFor(e) { return `${e.cardId}:${e.variation ?? ""}`; }
  function isSelected(e) { return selected.some((s) => s.key === keyFor(e)); }

  function toggle(entry) {
    const key = keyFor(entry);
    if (isSelected(entry)) {
      onChange(selected.filter((s) => s.key !== key));
    } else {
      onChange([...selected, {
        key,
        cardId:    entry.cardId,
        name:      entry.card?.name ?? entry.cardId,
        image:     entry.card?.images?.small ?? null,
        variant:   entry.variation ?? null,
        condition: entry.condition ?? null,
        quantity:  1,
        max:       entry.quantity ?? 1,
      }]);
    }
  }
  function setQty(key, q) {
    onChange(selected.map((s) => s.key === key
      ? { ...s, quantity: Math.max(1, Math.min(s.max, parseInt(q, 10) || 1)) }
      : s));
  }

  const totalCards = selected.reduce((n, s) => n + s.quantity, 0);

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.inlineHeader}>
        <SectionLabel>Pick cards for the lot</SectionLabel>
        <Text style={styles.helperText}>{selected.length} unique · {totalCards} total</Text>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search your collection…"
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
        editable={!loading}
      />

      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ paddingVertical: 20 }} />
      ) : collection.length === 0 ? (
        <Text style={styles.emptyNote}>Your collection is empty. Add cards first.</Text>
      ) : (
        <ScrollView
          horizontal
          style={styles.cardStrip}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          showsHorizontalScrollIndicator={false}
        >
          {filtered.slice(0, 60).map((entry, i) => {
            const picked = isSelected(entry);
            const img = entry.card?.images?.small;
            return (
              <Pressable
                key={`${keyFor(entry)}-${i}`}
                onPress={() => toggle(entry)}
                style={[styles.cardTile, picked && styles.cardTilePicked]}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.cardImageFallback]}>
                    <Text style={styles.cardFallbackText} numberOfLines={2}>
                      {entry.card?.name ?? entry.cardId}
                    </Text>
                  </View>
                )}
                {picked && (
                  <View style={styles.cardPickedOverlay}>
                    <Text style={styles.cardPickedCheck}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selected.length > 0 && (
        <View style={styles.selectedList}>
          {selected.map((s) => (
            <View key={s.key} style={styles.selectedRow}>
              {s.image
                ? <Image source={{ uri: s.image }} style={styles.selectedThumb} />
                : <View style={styles.selectedThumb} />}
              <Text style={styles.selectedName} numberOfLines={1}>{s.name}</Text>
              {s.condition
                ? <Text style={styles.selectedMeta}>{s.condition}</Text>
                : null}
              <TextInput
                value={String(s.quantity)}
                onChangeText={(v) => setQty(s.key, v)}
                keyboardType="number-pad"
                style={styles.selectedQtyInput}
              />
              <Pressable onPress={() => onChange(selected.filter((x) => x.key !== s.key))} hitSlop={8}>
                <Text style={{ color: COLORS.danger, paddingHorizontal: 4 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export default function BulkLotSheet({ visible, onClose, onCreated }) {
  const insets = useSafeAreaInsets();
  const client = useApolloClient();
  const router = useRouter();

  // Mode
  const [kind, setKind] = useState("BULK_TRACKED");

  // Shared
  const [title, setTitle]         = useState("");
  const [description, setDesc]    = useState("");
  const [price, setPrice]         = useState("");
  const [condMin, setCondMin]     = useState("NM");
  const [condMax, setCondMax]     = useState("LP");
  const [inclusions, setIncl]     = useState([]);
  const [parcelSize, setParcel]   = useState("MEDIUM_PARCEL");
  const [labelPaidBy, setPaidBy]  = useState("buyer");
  const [allowOffers, setOffers]  = useState(true);

  // Tracked
  const [collection, setCollection] = useState([]);
  const [colLoading, setColLoading] = useState(false);
  const [selected, setSelected]     = useState([]);

  // Random
  const [cardCount, setCardCount] = useState("");
  const [lotPhoto, setLotPhoto]   = useState(null); // { uri, base64 }

  // Submit
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [createBulkLot, { loading: submitting }] = useMutation(CreateBulkLotDocument, {
    refetchQueries: [{ query: MyMarketListingsDocument, variables: { limit: 40 } }],
    awaitRefetchQueries: true,
  });

  // Reset on open
  useEffect(() => {
    if (!visible) return;
    setKind("BULK_TRACKED");
    setTitle(""); setDesc(""); setPrice("");
    setCondMin("NM"); setCondMax("LP");
    setIncl([]); setParcel("MEDIUM_PARCEL"); setPaidBy("buyer"); setOffers(true);
    setSelected([]); setCardCount(""); setLotPhoto(null);
    setErr(""); setDone(false);
  }, [visible]);

  // Load collection when switching to Tracked (first time only)
  useEffect(() => {
    if (!visible || kind !== "BULK_TRACKED" || collection.length) return;
    setColLoading(true);
    client.query({ query: MyCollectionForListingDocument, fetchPolicy: "network-only" })
      .then(({ data }) => setCollection(data?.myCollection || []))
      .catch(() => setCollection([]))
      .finally(() => setColLoading(false));
  }, [visible, kind, collection.length, client]);

  // Keep condition range self-consistent
  function changeMin(c) {
    setCondMin(c);
    if (conditionRank(c) > conditionRank(condMax)) setCondMax(c);
  }
  function changeMax(c) {
    setCondMax(c);
    if (conditionRank(c) < conditionRank(condMin)) setCondMin(c);
  }

  async function pickLotPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access to upload a lot photo.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setLotPhoto({ uri: asset.uri, base64: `data:image/jpeg;base64,${asset.base64}` });
  }

  const totalTracked = selected.reduce((n, s) => n + s.quantity, 0);
  const resolvedCount = kind === "BULK_TRACKED" ? totalTracked : (parseInt(cardCount, 10) || 0);
  const perCard = (price && resolvedCount > 0)
    ? (parseFloat(price) / resolvedCount).toFixed(3)
    : null;

  function validate() {
    if (!title.trim()) return "Give the lot a title.";
    const p = parseFloat(price);
    if (!p || p <= 0) return "Enter a valid lot price.";
    if (!condMin || !condMax) return "Pick a condition range.";
    if (kind === "BULK_TRACKED") {
      if (selected.length === 0) return "Pick at least one card from your collection.";
    }
    if (kind === "BULK_RANDOM") {
      const n = parseInt(cardCount, 10);
      if (!n || n < MIN_CARD_COUNT) return `Random lots need at least ${MIN_CARD_COUNT} cards.`;
      if (!lotPhoto) return "Upload a photo of the lot.";
    }
    return null;
  }

  async function handleSubmit() {
    const bad = validate();
    if (bad) { setErr(bad); return; }
    setErr("");
    try {
      await createBulkLot({
        variables: {
          input: {
            listingKind: kind,
            title: title.trim(),
            description: description.trim() || null,
            price: parseFloat(price),
            currency: "GBP",
            conditionMin: condMin,
            conditionMax: condMax,
            cardCount: resolvedCount,
            guaranteedInclusions: inclusions
              .filter((i) => i.description.trim())
              .map((i) => ({ description: i.description.trim(), quantity: i.quantity })),
            parcelSize,
            labelPaidBy,
            allowOffers,
            items: kind === "BULK_TRACKED"
              ? selected.map((s) => ({
                  cardId:    s.cardId,
                  variant:   s.variant,
                  condition: s.condition,
                  quantity:  s.quantity,
                }))
              : null,
            lotPhotoBase64: kind === "BULK_RANDOM" ? lotPhoto.base64 : null,
          },
        },
      });
      setDone(true);
      onCreated?.();
    } catch (e) {
      setErr(e?.message || "Failed to create bulk lot.");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sell a bulk lot</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>

        {done ? (
          <View style={styles.doneWrap}>
            <Text style={styles.doneCheck}>✓</Text>
            <Text style={styles.doneTitle}>Bulk lot listed!</Text>
            <Text style={styles.doneBody}>
              {kind === "BULK_RANDOM"
                ? "Your lot is live — the uploaded photo serves as proof."
                : "Your lot is pending proof. Head to My Listings to complete it."}
            </Text>
            <Pressable style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 18 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tabs */}
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabBtn, kind === "BULK_TRACKED" && styles.tabBtnActive]}
                onPress={() => setKind("BULK_TRACKED")}
              >
                <Text style={[styles.tabText, kind === "BULK_TRACKED" && styles.tabTextActive]}>Tracked</Text>
                <Text style={styles.tabHint}>Pick from collection</Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, kind === "BULK_RANDOM" && styles.tabBtnActive]}
                onPress={() => setKind("BULK_RANDOM")}
              >
                <Text style={[styles.tabText, kind === "BULK_RANDOM" && styles.tabTextActive]}>Random</Text>
                <Text style={styles.tabHint}>Describe the lot</Text>
              </Pressable>
            </View>

            {/* Mode-specific */}
            {kind === "BULK_TRACKED" && (
              <TrackedPicker
                collection={collection}
                loading={colLoading}
                selected={selected}
                onChange={setSelected}
              />
            )}
            {kind === "BULK_RANDOM" && (
              <View style={{ gap: 10 }}>
                <View>
                  <SectionLabel>Card count</SectionLabel>
                  <TextInput
                    value={cardCount}
                    onChangeText={setCardCount}
                    placeholder={`${MIN_CARD_COUNT}+`}
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  <Text style={styles.helperText}>Minimum {MIN_CARD_COUNT}</Text>
                </View>
                <View>
                  <SectionLabel>Lot photo</SectionLabel>
                  {lotPhoto ? (
                    <View style={styles.photoPreviewWrap}>
                      <Image source={{ uri: lotPhoto.uri }} style={styles.photoPreview} />
                      <Pressable onPress={() => setLotPhoto(null)} style={styles.photoRemoveBtn}>
                        <Text style={{ color: COLORS.danger }}>Remove</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={styles.photoPickBtn} onPress={pickLotPhoto}>
                      <Text style={styles.photoPickText}>+ Choose a photo of the lot</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* Title */}
            <View>
              <SectionLabel>Title</SectionLabel>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={kind === "BULK_TRACKED"
                  ? "e.g. 200 Scarlet & Violet commons"
                  : "e.g. 500 random modern cards, mostly commons"}
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                maxLength={200}
              />
            </View>

            {/* Description */}
            <View>
              <SectionLabel optional>Description</SectionLabel>
              <TextInput
                value={description}
                onChangeText={setDesc}
                placeholder="Rarity mix, sets covered, anything buyers should know…"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
                multiline
                maxLength={1000}
              />
            </View>

            {/* Condition range */}
            <View style={{ gap: 10 }}>
              <SectionLabel>Condition range</SectionLabel>
              <View>
                <Text style={styles.subLabel}>Best</Text>
                <View style={styles.chipRow}>
                  {CONDITIONS.map((c) => (
                    <Chip key={c} active={condMin === c} onPress={() => changeMin(c)}>{c}</Chip>
                  ))}
                </View>
              </View>
              <View>
                <Text style={styles.subLabel}>Worst</Text>
                <View style={styles.chipRow}>
                  {CONDITIONS.map((c) => (
                    <Chip key={c} active={condMax === c} onPress={() => changeMax(c)}>{c}</Chip>
                  ))}
                </View>
              </View>
            </View>

            {/* Guaranteed inclusions */}
            <View>
              <SectionLabel optional>Guaranteed inclusions</SectionLabel>
              <InclusionsEditor items={inclusions} onChange={setIncl} />
            </View>

            {/* Price */}
            <View>
              <SectionLabel>Lot price</SectionLabel>
              <View style={styles.priceRow}>
                <Text style={styles.priceCurrency}>£</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
              {perCard && (
                <Text style={styles.helperText}>≈ £{perCard} per card</Text>
              )}
            </View>

            {/* Shipping */}
            <View>
              <SectionLabel>Parcel size</SectionLabel>
              <View style={styles.chipRow}>
                {PARCEL_SIZES.map((ps) => (
                  <Chip key={ps.value} active={parcelSize === ps.value} onPress={() => setParcel(ps.value)}>
                    {ps.label}
                  </Chip>
                ))}
              </View>
              <Text style={[styles.subLabel, { marginTop: 10 }]}>Shipping label paid by</Text>
              <View style={styles.chipRow}>
                <Chip active={labelPaidBy === "seller"} onPress={() => setPaidBy("seller")}>Seller</Chip>
                <Chip active={labelPaidBy === "buyer"} onPress={() => setPaidBy("buyer")}>Buyer</Chip>
              </View>
            </View>

            {/* Offers */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Accept offers on this lot</Text>
              <Switch
                value={allowOffers}
                onValueChange={setOffers}
                trackColor={{ false: COLORS.border, true: COLORS.accent }}
                thumbColor="#fff"
              />
            </View>

            {/* Random-only notice */}
            {kind === "BULK_RANDOM" && (
              <View style={styles.noticeWrap}>
                <Text style={styles.noticeText}>
                  <Text style={{ fontWeight: "600" }}>Random lots are final-sale.</Text>{" "}
                  Buyers can only dispute if the lot differs materially from the photo, count, or guaranteed inclusions.
                </Text>
              </View>
            )}

            {err ? (
              <View>
                <Text style={styles.errorText}>{err}</Text>
                {/listing limit/i.test(err) && (
                  <Text
                    style={[styles.errorText, { color: COLORS.accent, textDecorationLine: "underline" }]}
                    onPress={() => {
                      onClose?.();
                      router.push("/subscriptions");
                    }}
                  >
                    Upgrade your plan →
                  </Text>
                )}
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>List this lot</Text>}
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: "600" },
  closeBtn:    { color: COLORS.textMuted, fontSize: 18, paddingHorizontal: 6 },

  tabRow: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.card,
  },
  tabBtnActive: { backgroundColor: COLORS.accent },
  tabText:  { color: COLORS.textMuted, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  tabHint:  { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },

  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  optional: { color: COLORS.textMuted, fontWeight: "400", textTransform: "none", fontSize: 11 },
  subLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 6 },
  helperText: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  inlineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },

  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive:   { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipDisabled: { opacity: 0.4 },
  chipText:     { color: COLORS.textMuted, fontSize: 12, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  chipRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },

  inclusionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addLink:      { color: COLORS.accent, fontSize: 13, fontWeight: "500", paddingVertical: 4 },

  cardStrip:    { maxHeight: 110 },
  cardTile:     { width: 60, height: 84, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  cardTilePicked: { borderColor: "#10B981", borderWidth: 2 },
  cardImage:    { width: "100%", height: "100%", resizeMode: "contain" },
  cardImageFallback: { alignItems: "center", justifyContent: "center", padding: 4 },
  cardFallbackText: { color: COLORS.textMuted, fontSize: 9, textAlign: "center" },
  cardPickedOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(16,185,129,0.3)", alignItems: "center", justifyContent: "center" },
  cardPickedCheck: { color: "#10B981", fontSize: 24, fontWeight: "700" },

  selectedList: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8, gap: 6, maxHeight: 180 },
  selectedRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  selectedThumb: { width: 24, height: 32, borderRadius: 3, backgroundColor: COLORS.card },
  selectedName: { flex: 1, color: COLORS.text, fontSize: 12 },
  selectedMeta: { color: COLORS.textMuted, fontSize: 10 },
  selectedQtyInput: { width: 48, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, color: COLORS.text, textAlign: "center", fontSize: 12 },

  emptyNote: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", padding: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },

  photoPickBtn: { borderWidth: 1, borderStyle: "dashed", borderColor: COLORS.border, borderRadius: 8, padding: 24, alignItems: "center" },
  photoPickText: { color: COLORS.textMuted, fontSize: 13 },
  photoPreviewWrap: { gap: 8 },
  photoPreview: { width: "100%", height: 180, borderRadius: 8, backgroundColor: COLORS.card },
  photoRemoveBtn: { alignSelf: "flex-start" },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceCurrency: { color: COLORS.text, fontSize: 16, fontWeight: "500" },

  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { color: COLORS.text, fontSize: 13 },

  noticeWrap: { backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", borderRadius: 8, padding: 12 },
  noticeText: { color: "#D97706", fontSize: 12, lineHeight: 18 },

  errorText: { color: COLORS.danger, fontSize: 12, marginVertical: 2 },

  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  doneWrap:  { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  doneCheck: { color: "#10B981", fontSize: 48 },
  doneTitle: { color: COLORS.text, fontSize: 18, fontWeight: "600" },
  doneBody:  { color: COLORS.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20 },
});
