// components/market/CreateListingSheet.js
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { gql, useApolloClient, useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  MyCollectionForListingDocument,
  PriceSuggestionDocument,
  CreateListingDocument,
  MyMarketListingsDocument,
} from "../../graphql/documents";

const Q_CATALOG_PRICE = gql`
  query CreateListing_CatalogPrice($id: ID!) {
    cardsearchCard(id: $id) {
      id
      latestPrices {
        provider currency gbp low mid high market variation updatedAt
      }
    }
  }
`;

const CONDITIONS = ["NM", "LP", "MP", "PL"];
const COND_LABEL = { NM: "Near Mint", LP: "Lightly Played", MP: "Moderately Played", PL: "Played" };
// Shown while catalog data is loading or when the card has no catalog record.
const FALLBACK_VARIATIONS = ["Standard", "Reverse Holo", "Holo"];
const PARCEL_SIZES = [
  { value: "LARGE_LETTER", label: "Large Letter", hint: "Up to 500g" },
  { value: "SMALL_PARCEL",  label: "Small Parcel",  hint: "Up to 1kg"  },
  { value: "MEDIUM_PARCEL", label: "Medium Parcel", hint: "Up to 5kg"  },
];
const EMBARGO_DAYS = 14;

function isEmbargoed(releaseDate) {
  if (!releaseDate) return null;
  const released = new Date(releaseDate);
  const embargoEnd = new Date(released.getTime() + EMBARGO_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  if (now >= embargoEnd) return null;
  const daysLeft = Math.ceil((embargoEnd - now) / (1000 * 60 * 60 * 24));
  return { endsAt: embargoEnd.toISOString().slice(0, 10), daysLeft };
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function CreateListingSheet({ visible, onClose, onCreated }) {
  const insets = useSafeAreaInsets();
  const client = useApolloClient();

  // Steps: "pick" | "details" | "done"
  const [step, setStep] = useState("pick");
  const [collection, setCollection] = useState([]);
  const [loadingColl, setLoadingColl] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Form fields
  const [condition, setCondition] = useState("NM");
  const [variation, setVariation] = useState("Standard");
  const [price, setPrice] = useState("");
  const [parcelSize, setParcelSize] = useState("LARGE_LETTER");
  const [labelPaidBy, setLabelPaidBy] = useState("seller");
  const [allowOffers, setAllowOffers] = useState(true);
  const [willTrade, setWillTrade] = useState(false);
  const [description, setDescription] = useState("");

  // Price suggestions (marketplace listings)
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(false);

  // Catalog price (cardsearch service)
  const [catalogPrices, setCatalogPrices] = useState(null); // array of latestPrices rows

  const [createListing, { loading: submitting }] = useMutation(CreateListingDocument, {
    refetchQueries: [{ query: MyMarketListingsDocument, variables: { limit: 40 } }],
    awaitRefetchQueries: true,
  });
  const [err, setErr] = useState("");

  // Load collection on open
  useEffect(() => {
    if (!visible) return;
    setStep("pick");
    setSelectedEntry(null);
    setSearch("");
    setCondition("NM");
    setVariation("Standard");
    setPrice("");
    setParcelSize("LARGE_LETTER");
    setLabelPaidBy("seller");
    setAllowOffers(true);
    setWillTrade(false);
    setDescription("");
    setSuggestions([]);
    setCatalogPrices(null);
    setErr("");
    setLoadingColl(true);
    client.query({ query: MyCollectionForListingDocument, fetchPolicy: "network-only" })
      .then(({ data }) => setCollection(data?.myCollection || []))
      .catch(() => {})
      .finally(() => setLoadingColl(false));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch price suggestions + catalog price when card selected
  useEffect(() => {
    if (!selectedEntry?.cardId) return;
    const cardId = selectedEntry.cardId;

    // Marketplace listing prices
    setLoadingSugg(true);
    client.query({
      query: PriceSuggestionDocument,
      variables: { cardId },
      fetchPolicy: "network-only",
    })
      .then(({ data }) => {
        const prices = (data?.listings || [])
          .map((l) => (l?.price != null ? Number(l.price) : null))
          .filter((p) => p != null && p > 0);
        setSuggestions(prices);
      })
      .catch(() => {})
      .finally(() => setLoadingSugg(false));

    // Catalog price (cardsearch service — best-effort, silent on miss)
    client.query({
      query: Q_CATALOG_PRICE,
      variables: { id: cardId },
      fetchPolicy: "network-only",
    })
      .then(({ data }) => {
        const prices = data?.cardsearchCard?.latestPrices;
        setCatalogPrices(Array.isArray(prices) && prices.length ? prices : null);
      })
      .catch(() => setCatalogPrices(null));
  }, [selectedEntry?.cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return collection;
    const q = search.toLowerCase();
    return collection.filter((e) => {
      const name = (e.card?.name || e.cardId || "").toLowerCase();
      const set = (e.card?.set?.name || "").toLowerCase();
      return name.includes(q) || set.includes(q);
    });
  }, [collection, search]);

  function selectCard(entry) {
    setSelectedEntry(entry);
    // Auto-set variation from rarity
    const r = (entry.card?.rarity || "").toLowerCase();
    if (r.includes("reverse")) setVariation("Reverse Holo");
    else if (r.includes("holo")) setVariation("Holo");
    else setVariation("Standard");
    setStep("details");
  }

  async function handleSubmit() {
    const priceNum = parseFloat(price);
    if (!priceNum || priceNum <= 0) { setErr("Enter a valid price."); return; }
    setErr("");
    try {
      await createListing({
        variables: {
          input: {
            cardId: selectedEntry.cardId,
            title: card?.name || selectedEntry.cardId,
            condition,
            variant: variation,
            price: priceNum,
            currency: "GBP",
            parcelSize,
            labelPaidBy,
            allowOffers,
            willTrade,
            description: description.trim() || undefined,
          },
        },
      });
      setStep("done");
      onCreated?.();
    } catch (e) {
      setErr(e.message || "Failed to create listing");
    }
  }

  const card = selectedEntry?.card;
  const imageUrl = card?.images?.large || card?.images?.small || null;
  const embargo = isEmbargoed(card?.set?.releaseDate);

  const low = suggestions.length ? Math.min(...suggestions) : null;
  const med = median(suggestions);

  // Variations derived from catalog data — only pills with price records appear.
  // Falls back to a short default list while loading or when the card is not in the catalog.
  const availableVariations = useMemo(() => {
    if (!catalogPrices) return FALLBACK_VARIATIONS;
    const seen = new Set();
    const vars = [];
    for (const row of catalogPrices) {
      const v = row?.variation;
      if (v && !seen.has(v)) { seen.add(v); vars.push(v); }
    }
    return vars.length ? vars : FALLBACK_VARIATIONS;
  }, [catalogPrices]);

  // Snap the selected variation to the first available one if it's not in the list.
  useEffect(() => {
    if (!availableVariations.includes(variation)) {
      setVariation(availableVariations[0]);
    }
  }, [availableVariations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Catalog price for the currently selected variation (falls back to first row).
  const catalogGbp = useMemo(() => {
    if (!catalogPrices?.length) return null;
    const match = catalogPrices.find(
      (row) => row?.variation?.toLowerCase() === variation?.toLowerCase()
    );
    const row = match ?? catalogPrices[0];
    const v = row?.gbp ?? row?.market ?? row?.mid ?? null;
    return v != null && Number(v) > 0 ? Number(v) : null;
  }, [catalogPrices, variation]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === "pick" ? "Choose a card" :
             step === "details" ? "Listing details" : "Listing created"}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.doneText}>{step === "done" ? "Done" : "Cancel"}</Text>
          </Pressable>
        </View>

        {/* ── Step: pick ── */}
        {step === "pick" && (
          <>
            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search your collection…"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <ScrollView contentContainerStyle={styles.pickList} keyboardShouldPersistTaps="handled">
              {loadingColl ? (
                <ActivityIndicator color={COLORS.accent} style={{ marginTop: 32 }} />
              ) : filtered.length === 0 ? (
                <Text style={styles.emptyText}>
                  {collection.length === 0 ? "Your collection is empty." : "No cards match."}
                </Text>
              ) : (
                filtered.map((entry, i) => {
                  const c = entry.card;
                  const img = c?.images?.small;
                  return (
                    <Pressable key={`${entry.cardId}-${i}`} onPress={() => selectCard(entry)} style={styles.pickRow}>
                      <View style={styles.pickThumb}>
                        {img && <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName} numberOfLines={1}>{c?.name || entry.cardId}</Text>
                        <Text style={styles.pickMeta} numberOfLines={1}>
                          {[c?.set?.name, c?.number ? `#${c.number}` : null, c?.rarity].filter(Boolean).join(" · ")}
                        </Text>
                        <Text style={styles.pickQty}>×{entry.quantity} in collection</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </>
        )}

        {/* ── Step: details ── */}
        {step === "details" && selectedEntry && (
          <ScrollView contentContainerStyle={styles.detailScroll} keyboardShouldPersistTaps="handled">
            {/* Card preview */}
            <View style={styles.previewRow}>
              <View style={styles.previewThumb}>
                {imageUrl && <Image source={{ uri: imageUrl }} style={styles.previewImg} resizeMode="contain" />}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.previewName}>{card?.name || selectedEntry.cardId}</Text>
                <Text style={styles.previewMeta}>
                  {[card?.set?.name, card?.number ? `#${card.number}` : null].filter(Boolean).join(" · ")}
                </Text>
                {card?.rarity && <Text style={styles.previewRarity}>{card.rarity}</Text>}
              </View>
            </View>

            {embargo && (
              <View style={styles.embargoBox}>
                <Text style={styles.embargoText}>
                  ⏳ This set is under a {EMBARGO_DAYS}-day listing embargo ({embargo.daysLeft} day{embargo.daysLeft !== 1 ? "s" : ""} left). You can prepare the listing but it won't go live until {embargo.endsAt}.
                </Text>
              </View>
            )}

            {/* Condition */}
            <Text style={styles.fieldLabel}>Condition</Text>
            <View style={styles.chipRow}>
              {CONDITIONS.map((c) => (
                <Pressable key={c} onPress={() => setCondition(c)}
                  style={[styles.chip, condition === c && styles.chipActive]}>
                  <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>
                    {c} · {COND_LABEL[c]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Variation — pills come from catalog price data; only available variations appear */}
            <Text style={styles.fieldLabel}>Variation</Text>
            <View style={styles.chipRow}>
              {availableVariations.map((v) => (
                <Pressable key={v} onPress={() => setVariation(v)}
                  style={[styles.chip, variation === v && styles.chipActive]}>
                  <Text style={[styles.chipText, variation === v && styles.chipTextActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>

            {/* Price */}
            <Text style={styles.fieldLabel}>Price (£)</Text>

            {/* Catalog price reference */}
            {catalogGbp != null && (
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Catalog market value</Text>
                <Pressable onPress={() => setPrice(catalogGbp.toFixed(2))} style={styles.refChip}>
                  <Text style={styles.refValue}>£{catalogGbp.toFixed(2)}</Text>
                  <Text style={styles.refTap}>tap to use</Text>
                </Pressable>
              </View>
            )}

            {/* Marketplace listing suggestions */}
            {(loadingSugg) ? (
              <ActivityIndicator color={COLORS.accent} size="small" style={{ alignSelf: "flex-start" }} />
            ) : suggestions.length > 0 ? (
              <View style={styles.suggRow}>
                {low != null && (
                  <Pressable onPress={() => setPrice(low.toFixed(2))} style={styles.suggChip}>
                    <Text style={styles.suggText}>Low £{low.toFixed(2)}</Text>
                  </Pressable>
                )}
                {med != null && (
                  <Pressable onPress={() => setPrice(med.toFixed(2))} style={styles.suggChip}>
                    <Text style={styles.suggText}>Median £{med.toFixed(2)}</Text>
                  </Pressable>
                )}
                <Text style={styles.suggHint}>{suggestions.length} active listing{suggestions.length !== 1 ? "s" : ""}</Text>
              </View>
            ) : catalogGbp == null ? (
              <Text style={styles.suggHint}>No price data available</Text>
            ) : null}
            <View style={styles.priceInputWrap}>
              <Text style={styles.currencySymbol}>£</Text>
              <TextInput
                style={styles.priceInput}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            {/* Parcel size */}
            <Text style={styles.fieldLabel}>Shipping size</Text>
            <View style={styles.chipRow}>
              {PARCEL_SIZES.map((p) => (
                <Pressable key={p.value} onPress={() => setParcelSize(p.value)}
                  style={[styles.chip, parcelSize === p.value && styles.chipActive]}>
                  <Text style={[styles.chipText, parcelSize === p.value && styles.chipTextActive]}>
                    {p.label}
                  </Text>
                  <Text style={[styles.chipHint, parcelSize === p.value && { color: "#fff" }]}>
                    {p.hint}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Who pays shipping */}
            <Text style={styles.fieldLabel}>Who pays shipping?</Text>
            <View style={styles.chipRow}>
              {[
                { value: "seller", label: "Seller pays", hint: "Cost absorbed by you" },
                { value: "buyer",  label: "Buyer pays",  hint: "Added at checkout" },
              ].map((opt) => (
                <Pressable key={opt.value} onPress={() => setLabelPaidBy(opt.value)}
                  style={[styles.chip, labelPaidBy === opt.value && styles.chipActive]}>
                  <Text style={[styles.chipText, labelPaidBy === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.chipHint, labelPaidBy === opt.value && { color: "#fff" }]}>
                    {opt.hint}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Toggles */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Accept offers</Text>
                <Text style={styles.toggleSub}>Let buyers make offers below your asking price</Text>
              </View>
              <Switch value={allowOffers} onValueChange={setAllowOffers} />
            </View>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Open to trades</Text>
                <Text style={styles.toggleSub}>Allow buyers to propose card trades</Text>
              </View>
              <Switch value={willTrade} onValueChange={setWillTrade} />
            </View>

            {/* Description */}
            <Text style={styles.fieldLabel}>Seller notes (optional)</Text>
            <TextInput
              style={styles.textarea}
              value={description}
              onChangeText={setDescription}
              placeholder="Any extra details about the card's condition…"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {err ? <Text style={styles.errText}>{err}</Text> : null}

            <View style={styles.submitRow}>
              <Pressable onPress={() => setStep("pick")} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>Create listing</Text>
                }
              </Pressable>
            </View>
          </ScrollView>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <View style={styles.successBox}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Listing created!</Text>
            <Text style={styles.successSub}>
              Your card has been listed. It will appear in the marketplace once approved.
            </Text>
            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  doneText: { color: COLORS.accent, fontWeight: "600", fontSize: 15 },

  searchWrap: { padding: 12, paddingBottom: 0 },
  searchInput: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: COLORS.text,
    fontSize: 14,
  },
  pickList: { padding: 12, gap: 8 },
  pickRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 10,
  },
  pickThumb: {
    width: 48,
    height: 67,
    borderRadius: 6,
    backgroundColor: COLORS.alt,
    overflow: "hidden",
  },
  pickName: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  pickMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  pickQty: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  emptyText: { color: COLORS.textMuted, textAlign: "center", marginTop: 32 },

  detailScroll: { padding: 14, gap: 12, paddingBottom: 40 },

  previewRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: COLORS.alt,
    borderRadius: 14,
    padding: 12,
    alignItems: "flex-start",
  },
  previewThumb: {
    width: 60,
    height: 84,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    overflow: "hidden",
  },
  previewImg: { width: "100%", height: "100%" },
  previewName: { color: COLORS.text, fontWeight: "800", fontSize: 15 },
  previewMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  previewRarity: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },

  embargoBox: {
    backgroundColor: "rgba(251,191,36,0.1)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    borderRadius: 10,
    padding: 10,
  },
  embargoText: { color: "#fbbf24", fontSize: 12, lineHeight: 17 },

  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: -4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: COLORS.alt,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  chipHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },

  refRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refLabel: { color: COLORS.textMuted, fontSize: 12 },
  refChip: { alignItems: "flex-end" },
  refValue: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  refTap: { color: COLORS.accent, fontSize: 10, fontWeight: "600" },

  suggRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  suggChip: {
    backgroundColor: "rgba(41,99,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(41,99,255,0.3)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  suggText: { color: COLORS.accent, fontSize: 12, fontWeight: "700" },
  suggHint: { color: COLORS.textMuted, fontSize: 11 },

  priceInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: { color: COLORS.textMuted, fontSize: 16, marginRight: 6 },
  priceInput: { flex: 1, color: COLORS.text, fontSize: 18, fontWeight: "700", paddingVertical: 11 },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.alt,
    borderRadius: 12,
    padding: 12,
  },
  toggleLabel: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  toggleSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  textarea: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: COLORS.text,
    fontSize: 13,
    minHeight: 80,
  },

  errText: { color: COLORS.error, fontSize: 12 },

  submitRow: { flexDirection: "row", gap: 10 },
  backBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  backBtnText: { color: COLORS.textSecondary, fontWeight: "600" },
  submitBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  successBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  successEmoji: { fontSize: 48 },
  successTitle: { color: COLORS.text, fontWeight: "800", fontSize: 22 },
  successSub: { color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  doneBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
