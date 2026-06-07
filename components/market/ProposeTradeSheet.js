// components/market/ProposeTradeSheet.js
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApolloClient, useMutation } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import {
  MyCollectionForTradeDocument,
  MyWalletDocument,
  InitiateTradeDocument,
} from "../../graphql/documents";

const COND_COLOR = { NM: "#10b981", LP: "#eab308", MP: "#f97316", PL: "#ef4444" };

function fmt(n, currency = "GBP") {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(n) || 0); }
  catch { return `£${Number(n || 0).toFixed(2)}`; }
}

function CollectionRow({ entry, selected, onToggle }) {
  const card = entry.card || {};
  const img = card.images?.small || null;
  const isSelected = selected.has(entry.id);

  return (
    <Pressable
      onPress={() => onToggle(entry)}
      style={[styles.colRow, isSelected && styles.colRowSelected]}
    >
      <View style={styles.colThumb}>
        {img && <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.colName} numberOfLines={1}>{card.name || entry.cardId}</Text>
        <Text style={styles.colMeta} numberOfLines={1}>
          {[card.set?.name, card.number ? `#${card.number}` : null, entry.condition]
            .filter(Boolean).join(" · ")}
        </Text>
      </View>
      {entry.quantity > 1 && (
        <Text style={styles.colQty}>×{entry.quantity}</Text>
      )}
      <View style={[styles.colCheck, isSelected && styles.colCheckSelected]}>
        {isSelected && <Text style={styles.colCheckTick}>✓</Text>}
      </View>
    </Pressable>
  );
}

export default function ProposeTradeSheet({ listing, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const client = useApolloClient();

  const [collection, setCollection] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletCurrency, setWalletCurrency] = useState("GBP");
  const [loadingData, setLoadingData] = useState(false);

  const [selected, setSelected] = useState(new Map());
  const [search, setSearch] = useState("");
  const [topUp, setTopUp] = useState("");
  const [showTopUp, setShowTopUp] = useState(false);

  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const [initiateTrade, { loading: busy }] = useMutation(InitiateTradeDocument);

  // Load collection + wallet when sheet opens
  useEffect(() => {
    if (!visible) return;
    setSelected(new Map());
    setSearch("");
    setTopUp("");
    setShowTopUp(false);
    setDone(false);
    setErr("");
    setLoadingData(true);

    Promise.all([
      client.query({ query: MyCollectionForTradeDocument, fetchPolicy: "cache-and-network" })
        .then(({ data }) => setCollection(data?.myCollection || [])),
      client.query({ query: MyWalletDocument, fetchPolicy: "cache-and-network" })
        .then(({ data }) => {
          setWalletBalance(data?.myWallet?.balance ?? null);
          setWalletCurrency(data?.myWallet?.currency || "GBP");
        }),
    ])
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = listing?.cardInfo || {};
  const seller = listing?.seller || {};
  const imageUrl = info.imageSmall || info.imageLarge || null;

  const filtered = useMemo(() => {
    if (!search.trim()) return collection;
    const q = search.toLowerCase();
    return collection.filter((e) => {
      const name = (e.card?.name || e.cardId || "").toLowerCase();
      const set = (e.card?.set?.name || "").toLowerCase();
      return name.includes(q) || set.includes(q);
    });
  }, [collection, search]);

  function toggleEntry(entry) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.set(entry.id, entry);
      return next;
    });
  }

  const topUpNum = parseFloat(topUp) || 0;
  const topUpExceeds = walletBalance != null && topUpNum > 0 && topUpNum > walletBalance;

  async function handleSubmit() {
    if (selected.size === 0) { setErr("Select at least one card to offer."); return; }
    if (topUpExceeds) { setErr("Top-up exceeds your wallet balance."); return; }
    setErr("");
    try {
      const offeredCards = [...selected.values()].map((e) => ({
        cardId: e.cardId,
        quantity: 1,
        condition: e.condition || undefined,
        variation: e.variation || undefined,
      }));
      const wantedCards = [{
        cardId: listing.cardId,
        quantity: 1,
        condition: listing.condition || undefined,
        variation: listing.variation || undefined,
      }];
      await initiateTrade({
        variables: {
          userId: seller.id,
          offeredCards,
          wantedCards,
          topUpAmount: topUpNum > 0 ? topUpNum : null,
        },
      });
      setDone(true);
    } catch (e) {
      setErr(e.message || "Failed to send trade proposal");
    }
  }

  if (!listing) return null;

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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Propose a trade</Text>
            {seller.username && (
              <Text style={styles.subtitle}>with {seller.username}</Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.doneText}>Close</Text>
          </Pressable>
        </View>

        {/* Wallet strip */}
        <View style={styles.walletStrip}>
          <Text style={styles.walletLabel}>👛 Wallet balance</Text>
          <Text style={styles.walletValue}>
            {walletBalance != null ? fmt(walletBalance, walletCurrency) : "—"}
          </Text>
        </View>

        {/* Done state */}
        {done ? (
          <View style={styles.successBox}>
            <Text style={styles.successEmoji}>🤝</Text>
            <Text style={styles.successTitle}>Trade proposed!</Text>
            <Text style={styles.successSub}>
              Your offer has been sent to {seller.username || "the seller"}. They can accept, counter,
              or decline from their trades inbox.
            </Text>
            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Trade summary: they send / you offer */}
            <View style={styles.summaryRow}>
              {/* They send */}
              <View style={styles.summaryHalf}>
                <Text style={styles.summaryLabel}>They send you</Text>
                <View style={styles.summaryCard}>
                  <View style={styles.summaryThumb}>
                    {imageUrl && (
                      <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                    )}
                  </View>
                  <Text style={styles.summaryCardName} numberOfLines={2}>
                    {info.name || listing.cardId || "Card"}
                  </Text>
                  <View style={styles.summaryBadges}>
                    {listing.condition && (
                      <View style={[styles.condBadge, { backgroundColor: (COND_COLOR[listing.condition] || "#6b7280") + "33" }]}>
                        <Text style={[styles.condBadgeText, { color: COND_COLOR[listing.condition] || "#6b7280" }]}>
                          {listing.condition}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* You offer */}
              <View style={styles.summaryHalf}>
                <Text style={styles.summaryLabel}>
                  You offer{selected.size > 0 ? ` (${selected.size})` : ""}
                </Text>
                {selected.size === 0 ? (
                  <View style={styles.summaryEmpty}>
                    <Text style={styles.summaryEmptyText}>Select cards below ↓</Text>
                  </View>
                ) : (
                  <View style={styles.selectedPills}>
                    {[...selected.values()].map((e) => (
                      <Pressable key={e.id} onPress={() => toggleEntry(e)} style={styles.selectedPill}>
                        {e.card?.images?.small && (
                          <Image source={{ uri: e.card.images.small }} style={styles.pillThumb} resizeMode="contain" />
                        )}
                        <Text style={styles.pillName} numberOfLines={1}>
                          {e.card?.name || e.cardId}
                        </Text>
                        <Text style={styles.pillRemove}>✕</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Collection picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your collection — pick cards to offer</Text>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search your collection…"
                placeholderTextColor={COLORS.textMuted}
              />
              {loadingData ? (
                <ActivityIndicator color={COLORS.accent} style={{ marginTop: 16 }} />
              ) : filtered.length === 0 ? (
                <Text style={styles.emptyText}>
                  {collection.length === 0 ? "Your collection is empty." : "No cards match."}
                </Text>
              ) : (
                <View style={styles.colList}>
                  {filtered.map((entry) => (
                    <CollectionRow
                      key={entry.id}
                      entry={entry}
                      selected={selected}
                      onToggle={toggleEntry}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Cash sweetener */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Cash sweetener (optional)</Text>
              {!showTopUp ? (
                <Pressable onPress={() => setShowTopUp(true)}>
                  <Text style={styles.addTopUpText}>+ Add cash to sweeten the deal</Text>
                </Pressable>
              ) : (
                <View style={styles.topUpRow}>
                  <View style={styles.topUpInputWrap}>
                    <Text style={styles.currencySymbol}>£</Text>
                    <TextInput
                      style={styles.topUpInput}
                      value={topUp}
                      onChangeText={setTopUp}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                  <Pressable onPress={() => { setTopUp(""); setShowTopUp(false); }}>
                    <Text style={styles.removeTopUp}>Remove</Text>
                  </Pressable>
                </View>
              )}
              {topUpExceeds && (
                <Text style={styles.errText}>Exceeds wallet balance of {fmt(walletBalance, walletCurrency)}.</Text>
              )}
              {topUpNum > 0 && !topUpExceeds && (
                <Text style={styles.topUpHint}>
                  {fmt(topUpNum)} will be held from your wallet when the seller accepts.
                </Text>
              )}
            </View>

            {/* Error + submit */}
            {err ? <Text style={[styles.errText, { marginHorizontal: 14 }]}>{err}</Text> : null}

            <View style={styles.submitSection}>
              <Pressable
                onPress={handleSubmit}
                disabled={busy || selected.size === 0 || topUpExceeds}
                style={[styles.submitBtn, (busy || selected.size === 0 || topUpExceeds) && { opacity: 0.4 }]}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>
                      Send trade proposal to {seller.username || "seller"}
                    </Text>
                }
              </Pressable>
            </View>
          </ScrollView>
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
    padding: 16,
    paddingTop: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  doneText: { color: COLORS.accent, fontWeight: "600", fontSize: 15 },

  walletStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.alt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  walletLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  walletValue: { color: COLORS.text, fontSize: 13, fontWeight: "700" },

  scroll: { paddingBottom: 32 },

  summaryRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  summaryHalf: {
    flex: 1,
    padding: 14,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.border,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  summaryCard: { alignItems: "flex-start", gap: 5 },
  summaryThumb: {
    width: 52,
    height: 72,
    borderRadius: 8,
    backgroundColor: COLORS.alt,
    overflow: "hidden",
  },
  summaryCardName: { color: COLORS.text, fontSize: 12, fontWeight: "600" },
  summaryBadges: { flexDirection: "row", gap: 4 },
  condBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  condBadgeText: { fontSize: 9, fontWeight: "700" },

  summaryEmpty: {
    backgroundColor: COLORS.alt,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  summaryEmptyText: { color: COLORS.textMuted, fontSize: 11 },

  selectedPills: { gap: 5 },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.alt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pillThumb: { width: 20, height: 28, borderRadius: 3 },
  pillName: { flex: 1, color: COLORS.text, fontSize: 11, fontWeight: "500" },
  pillRemove: { color: COLORS.textMuted, fontSize: 11 },

  section: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
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
  colList: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  colRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  colRowSelected: { backgroundColor: COLORS.accent + "12" },
  colThumb: {
    width: 34,
    height: 47,
    borderRadius: 5,
    backgroundColor: COLORS.alt,
    overflow: "hidden",
  },
  colName: { color: COLORS.text, fontWeight: "600", fontSize: 12 },
  colMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  colQty: { color: COLORS.textMuted, fontSize: 11 },
  colCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  colCheckSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  colCheckTick: { color: "#fff", fontSize: 11, fontWeight: "800" },

  emptyText: { color: COLORS.textMuted, textAlign: "center", paddingVertical: 12 },

  addTopUpText: { color: COLORS.accent, fontWeight: "600", fontSize: 13 },
  topUpRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topUpInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  currencySymbol: { color: COLORS.textMuted, fontSize: 15, marginRight: 5 },
  topUpInput: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 9 },
  removeTopUp: { color: COLORS.error, fontWeight: "600" },
  topUpHint: { color: COLORS.textMuted, fontSize: 11 },

  errText: { color: COLORS.error, fontSize: 12 },

  submitSection: { padding: 14 },
  submitBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingVertical: 14,
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
