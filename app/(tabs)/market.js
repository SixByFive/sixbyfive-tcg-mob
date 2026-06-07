// app/(tabs)/market.js

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMutation } from "@apollo/client";
import { useQuery } from "@apollo/client";
import EditListingSheet from "../../components/market/EditListingSheet";

import EmptyState from "../../components/common/EmptyState";
import PageHeader from "../../components/common/PageHeader";
import { COLORS } from "../../theme/colors";

import CreateListingSheet from "../../components/market/CreateListingSheet";
import ListingDetailSheet from "../../components/market/ListingDetailSheet";
import ListingRow from "../../components/market/ListingRow";
import MarketplaceRulesSheet from "../../components/market/MarketplaceRulesSheet";
import MyListingRow from "../../components/market/MyListingRow";
import ProofCameraSheet from "../../components/market/ProofCameraSheet";
import SearchBar from "../../components/market/SearchBar";
import SegmentControl from "../../components/market/SegmentControl";
import TradesSection from "../../components/market/TradesSection";
import OrdersSection from "../../components/market/OrdersSection";
import OffersSection from "../../components/market/OffersSection";
import SellerSetupSheet from "../../components/market/SellerSetupSheet";
import SellerDashboardSheet from "../../components/market/SellerDashboardSheet";
import PartnersSpotlightSlider from "../../components/partners/PartnersSpotlightSlider";

const EVOLVED_HERO = require("../../assets/images/evolved.png");
const LEO_HERO = require("../../assets/images/leos.png");

const MARKET_PARTNERS = [
  {
    id: "evolved",
    partnerName: "Evolved Protection",
    tagline: "Evolve the way you protect your cards",
    blurb: "Trusted sleeves, toploaders & shields for serious collectors.",
    bullets: ["Sleeves that actually fit", "Toploaders you can trust"],
    ctaLabel: "Shop Evolved",
    ctaHref: "https://evolvedcardprotection.co.uk?sca_ref=9820478.MfkcaLj4ToIM",
    heroUri: EVOLVED_HERO,
    partnershipPillText: "In partnership with SixByFive TCG",
  },
  {
    id: "leo",
    partnerName: "Leo's Poké Vault",
    tagline: "",
    blurb: "Leo's Poké Vault, a family-run store built on a shared love of Pokémon and Trading Card Games!",
    bullets: [""],
    ctaLabel: "Shop Sealed",
    ctaHref: "https://www.leospokevault.co.uk",
    helper: "We're here to help you find the perfect cards, accessories, and supplies",
    heroUri: LEO_HERO,
    partnershipPillText: "In partnership with SixByFive TCG",
  },
];

import {
  BrowseListingsDocument,
  HasAgreedToMarketplaceRulesDocument,
  MyMarketListingsDocument,
  DeleteListingDocument,
  MeDocument,
} from "../../graphql/documents";

const SORT_OPTIONS = [
  { value: "",           label: "Newest" },
  { value: "PRICE_ASC",  label: "Price ↑" },
  { value: "PRICE_DESC", label: "Price ↓" },
];

export default function MarketTab() {
  const [segment, setSegment] = useState("browse"); // 'browse' | 'listings' | 'trades' | 'orders' | 'offers'
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("");
  const [browsePage, setBrowsePage] = useState(0);
  const BROWSE_PAGE_SIZE = 24;
  const [selectedListing, setSelectedListing] = useState(null);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [proofListing, setProofListing] = useState(null);
  const [showSellerSetup, setShowSellerSetup] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [editListing, setEditListing] = useState(null);

  const [deleteListing] = useMutation(DeleteListingDocument, {
    refetchQueries: [{ query: MyMarketListingsDocument, variables: { limit: 40 } }],
  });

  function handleDelistListing(item) {
    const name = item?.cardInfo?.name || item?.cardId || "this listing";
    Alert.alert(
      "Remove listing?",
      `"${name}" will be removed from the marketplace.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteListing({ variables: { id: item.id } });
            } catch (e) {
              Alert.alert("Error", e.message || "Failed to remove listing.");
            }
          },
        },
      ]
    );
  }

  // Check if the current user has agreed to marketplace rules
  const { data: meData } = useQuery(MeDocument, { fetchPolicy: "cache-first" });
  const myUserId = meData?.me?.id ?? null;
  const isLoggedIn = !!myUserId;

  const { data: agreedData, refetch: refetchAgreed } = useQuery(
    HasAgreedToMarketplaceRulesDocument,
    {
      fetchPolicy: "cache-and-network",
      skip: !isLoggedIn,
      onError: () => {}, // silently ignore if query doesn't exist on this backend version
    }
  );
  // Show rules sheet only when we have a definitive false (not null/undefined)
  const showRules = agreedData?.hasAgreedToMarketplaceRules === false;

  const {
    data: browseData,
    loading: browseLoading,
    refetch: refetchBrowse,
  } = useQuery(BrowseListingsDocument, {
    variables: {
      limit: BROWSE_PAGE_SIZE,
      offset: browsePage * BROWSE_PAGE_SIZE,
      sort: sort || undefined,
    },
    skip: segment !== "browse",
    fetchPolicy: "cache-and-network",
  });

  const {
    data: myData,
    loading: myLoading,
    error: myError,
    refetch: refetchMy,
  } = useQuery(MyMarketListingsDocument, {
    variables: { limit: 40 },
    fetchPolicy: "network-only",
    skip: !isLoggedIn,
  });

  // Reset to page 0 when sort or search changes
  useEffect(() => { setBrowsePage(0); }, [sort, query]);

  const browseListings = (browseData?.listings || []).filter((l) => l?.cardInfo);
  const myListings = myData?.myListings || [];

  const q = query.toLowerCase();
  const filteredBrowse = q
    ? browseListings.filter((l) => {
        const name = (l.cardInfo?.name || "").toLowerCase();
        const set = (l.cardInfo?.setName || "").toLowerCase();
        const seller = (l.seller?.username || "").toLowerCase();
        return name.includes(q) || set.includes(q) || seller.includes(q);
      })
    : browseListings;

  const filteredMy = q
    ? myListings.filter((l) =>
        (l.cardInfo?.name || "").toLowerCase().includes(q)
      )
    : myListings;

  const isLoading =
    (segment === "browse" && browseLoading) ||
    (segment === "listings" && myLoading && !myData);

  const onRefresh = useCallback(async () => {
    if (segment === "browse") await refetchBrowse();
    else if (segment === "listings") await refetchMy();
  }, [segment, refetchBrowse, refetchMy]);

  return (
    <View style={styles.container}>
      <PageHeader
        title="Market"
        subtitle="Buy, sell, and trade with the community"
      />

      <SegmentControl
        value={segment}
        onChange={setSegment}
        options={[
          { key: "browse", label: "Browse" },
          { key: "listings", label: "My Listings" },
          { key: "trades", label: "Trades" },
          { key: "offers", label: "Offers" },
          { key: "orders", label: "Orders" },
        ]}
      />

      {segment !== "trades" && segment !== "orders" && segment !== "offers" && (
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={
            segment === "browse"
              ? "Search cards, sets, sellers…"
              : "Filter my listings…"
          }
        />
      )}

      {/* Sort chips — browse tab only */}
      {segment === "browse" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.sortRow}
        >
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setSort(opt.value)}
              style={[styles.sortChip, sort === opt.value && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sort === opt.value && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {isLoading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.accent} size="small" />
        </View>
      )}

      {segment === "browse" && !browseLoading && (
        <FlatList
          data={filteredBrowse}
          keyExtractor={(it) => it.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          renderItem={({ item }) => (
            <ListingRow item={item} onPress={() => setSelectedListing(item)} />
          )}
          ListEmptyComponent={<EmptyState message="No listings found." />}
          ListFooterComponent={
            <View>
              {/* Pagination controls */}
              {!browseLoading && (
                <View style={styles.pagination}>
                  <Pressable
                    onPress={() => setBrowsePage((p) => Math.max(0, p - 1))}
                    disabled={browsePage === 0}
                    style={[styles.pageBtn, browsePage === 0 && { opacity: 0.35 }]}
                  >
                    <Text style={styles.pageBtnText}>← Prev</Text>
                  </Pressable>

                  <Text style={styles.pageIndicator}>Page {browsePage + 1}</Text>

                  <Pressable
                    onPress={() => setBrowsePage((p) => p + 1)}
                    disabled={filteredBrowse.length < BROWSE_PAGE_SIZE}
                    style={[styles.pageBtn, filteredBrowse.length < BROWSE_PAGE_SIZE && { opacity: 0.35 }]}
                  >
                    <Text style={styles.pageBtnText}>Next →</Text>
                  </Pressable>
                </View>
              )}

              {/* Partners */}
              {filteredBrowse.length > 0 && (
                <View style={styles.partnersFooter}>
                  <Text style={styles.partnersLabel}>Our Partners</Text>
                  <PartnersSpotlightSlider
                    partners={MARKET_PARTNERS}
                    showDots
                    autoplay
                  />
                </View>
              )}
            </View>
          }
        />
      )}

      {segment === "listings" && !myLoading && (
        <FlatList
          data={filteredMy}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          renderItem={({ item }) => (
            <MyListingRow
              item={item}
              onEdit={() => setEditListing(item)}
              onRemove={() => handleDelistListing(item)}
              onSubmitProof={() => setProofListing(item)}
            />
          )}
          ListHeaderComponent={
            <View style={{ gap: 8, marginBottom: 8 }}>
              <Pressable
                onPress={() => setShowCreateListing(true)}
                style={[styles.cta, { backgroundColor: COLORS.accent }]}
              >
                <Text style={styles.ctaText}>+ Create Listing</Text>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setShowDashboard(true)}
                  style={[styles.cta, { flex: 1, backgroundColor: COLORS.alt, borderWidth: 1, borderColor: COLORS.border }]}
                >
                  <Text style={[styles.ctaText, { color: COLORS.textMuted }]}>📊 Dashboard</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowSellerSetup(true)}
                  style={[styles.cta, { flex: 1, backgroundColor: COLORS.alt, borderWidth: 1, borderColor: COLORS.border }]}
                >
                  <Text style={[styles.ctaText, { color: COLORS.textMuted }]}>⚙ Settings</Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            myError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {myError.message?.includes("session") || myError.message?.includes("token") || myError.message?.includes("401")
                    ? "Your session has expired. Please log out and log back in."
                    : `Failed to load listings: ${myError.message}`}
                </Text>
                <Pressable onPress={() => refetchMy()} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <EmptyState message="You haven't listed any cards yet." />
            )
          }
        />
      )}

      {segment === "trades" && (
        <TradesSection myUserId={myUserId} />
      )}

      {segment === "offers" && (
        <OffersSection />
      )}

      {segment === "orders" && (
        <OrdersSection myUserId={myUserId} />
      )}

      {/* ── Sheets ── */}
      <ListingDetailSheet
        listing={selectedListing}
        visible={!!selectedListing}
        onClose={() => setSelectedListing(null)}
      />

      <CreateListingSheet
        visible={showCreateListing}
        onClose={() => {
          setShowCreateListing(false);
          // Refetch on close so the new listing is visible when the modal dismisses.
          if (segment === "listings") refetchMy();
        }}
        onCreated={() => {
          // Don't close yet — let the user see "Listing created!" and press Done.
          // The refetch is already queued via refetchQueries on the mutation.
          refetchMy();
        }}
      />

      <MarketplaceRulesSheet
        visible={showRules}
        isLoggedIn={isLoggedIn}
        onAgreed={() => refetchAgreed()}
      />

      <ProofCameraSheet
        visible={!!proofListing}
        listing={proofListing}
        onClose={() => setProofListing(null)}
        onSubmitted={() => {
          setProofListing(null);
          refetchMy();
        }}
      />

      <SellerSetupSheet
        visible={showSellerSetup}
        onClose={() => setShowSellerSetup(false)}
      />

      <SellerDashboardSheet
        visible={showDashboard}
        onClose={() => setShowDashboard(false)}
        myUserId={myUserId}
      />

      <EditListingSheet
        visible={!!editListing}
        listing={editListing}
        onClose={() => setEditListing(null)}
        onSaved={() => setEditListing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 40, gap: 10 },
  gridContent: { paddingHorizontal: 12, paddingVertical: 12 },
  gridRow: { gap: 10, marginBottom: 10 },
  loadingWrap: { paddingVertical: 32, alignItems: "center" },

  sortRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    alignItems: "center",
  },
  sortChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.alt,
    alignSelf: "flex-start",
  },
  sortChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  sortChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  sortChipTextActive: { color: "#fff" },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.alt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  pageBtnText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 13,
  },
  pageIndicator: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  partnersFooter: {
    marginTop: 16,
    marginBottom: 8,
  },
  partnersLabel: {
    color: COLORS.textMuted,
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  cta: { alignItems: "center", paddingVertical: 12, borderRadius: 12, marginHorizontal: 0 },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },

  errorBox: { padding: 24, alignItems: "center", gap: 12 },
  errorText: { color: COLORS.error, fontSize: 13, textAlign: "center", lineHeight: 19 },
  retryBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: { color: COLORS.textSecondary, fontWeight: "600", fontSize: 13 },
});
