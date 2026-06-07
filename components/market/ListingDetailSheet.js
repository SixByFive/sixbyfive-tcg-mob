// components/market/ListingDetailSheet.js
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useMutation, useQuery } from "@apollo/client";
import { COLORS } from "../../theme/colors";
import { CreateMarketOfferDocument, SellerReputationDocument } from "../../graphql/documents";
import { getApiBase } from "../../utils/getApiBase";
import SellerTierBadge from "./SellerTierBadge";
import SellerReviewsSheet from "./SellerReviewsSheet";
import ProposeTradeSheet from "./ProposeTradeSheet";
import CheckoutSheet from "./CheckoutSheet";

const COND = {
  NM: { color: "#10b981", label: "Near Mint" },
  LP: { color: "#eab308", label: "Lightly Played" },
  MP: { color: "#f97316", label: "Moderately Played" },
  PL: { color: "#ef4444", label: "Played" },
};

function fmt(amount, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(amount) || 0);
  } catch {
    return `£${Number(amount || 0).toFixed(2)}`;
  }
}

export default function ListingDetailSheet({ listing, visible, onClose }) {
  const insets = useSafeAreaInsets();
  const [imgSlide, setImgSlide] = useState(0); // 0=card, 1=proof
  const [lightbox, setLightbox] = useState(false);
  const [phase, setPhase] = useState("detail"); // "detail"|"offer"|"offered"
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [offerErr, setOfferErr] = useState("");
  const [showReviews, setShowReviews] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [createOffer, { loading: offerLoading }] = useMutation(CreateMarketOfferDocument);

  const seller = listing?.seller || {};
  const { data: repData } = useQuery(SellerReputationDocument, {
    variables: { userId: seller.id },
    skip: !seller.id || !visible,
    fetchPolicy: "cache-first",
  });
  const reputation = repData?.sellerReputation ?? null;

  if (!listing) return null;

  const info = listing.cardInfo || {};
  const isTradeOnly = listing.willTrade && (!listing.price || listing.price === 0);
  const price = Number(listing.price) || 0;
  const currency = listing.currency || "GBP";
  const cond = COND[listing.condition] || null;
  const imageUrl = info.imageLarge || info.imageSmall || null;
  const proofImgSrc = listing.proofImageUrl ? `${getApiBase()}${listing.proofImageUrl}` : null;
  const verified = listing.moderationResult === "approved";

  function handleToggle() {
    if (proofImgSrc) setImgSlide((s) => (s === 0 ? 1 : 0));
  }

  async function handleSendOffer() {
    const amount = parseFloat(offerAmount);
    if (!amount || amount <= 0) { setOfferErr("Enter a valid amount."); return; }
    setOfferErr("");
    try {
      await createOffer({
        variables: {
          listingId: listing.id,
          amount,
          message: offerMessage.trim() || undefined,
        },
      });
      setPhase("offered");
    } catch (e) {
      setOfferErr(e.message || "Failed to send offer");
    }
  }

  function handleBuyNow() {
    setShowCheckout(true);
  }

  function handleClose() {
    setImgSlide(0);
    setLightbox(false);
    setPhase("detail");
    setOfferAmount("");
    setOfferMessage("");
    setOfferErr("");
    setShowReviews(false);
    setShowTrade(false);
    onClose();
  }

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {info.name || listing.cardId || "Listing"}
          </Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        {/* ── Offered success ── */}
        {phase === "offered" ? (
          <View style={styles.successBox}>
            <Text style={styles.successEmoji}>📨</Text>
            <Text style={styles.successTitle}>Offer sent!</Text>
            <Text style={styles.successSub}>
              The seller will be notified and can accept, counter, or decline.
            </Text>
            <Pressable onPress={handleClose} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Image panel: tap anywhere to toggle card ↔ proof ── */}
            <Pressable onPress={handleToggle} style={styles.imagePanel}>
              {proofImgSrc && imgSlide === 1 ? (
                // Proof photo slide — inner Pressable opens lightbox
                <Pressable style={styles.imagePanelInner} onPress={() => setLightbox(true)}>
                  <Image
                    source={{ uri: proofImgSrc }}
                    style={styles.proofImage}
                    resizeMode="contain"
                  />
                  <View style={styles.enlargeHint}>
                    <Text style={styles.enlargeHintText}>Tap to enlarge</Text>
                  </View>
                </Pressable>
              ) : imageUrl ? (
                // Card image slide
                <View style={styles.imagePanelInner}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.cardImage}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View style={styles.noImage}>
                  <Text style={styles.noImageText}>No image</Text>
                </View>
              )}

              {/* Toggle label */}
              {proofImgSrc && (
                <View style={styles.toggleLabel}>
                  <Text style={styles.toggleLabelText}>
                    {imgSlide === 0 ? "Tap to view proof photo" : "Tap to view card"}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* ── Detail content ── */}
            <View style={styles.details}>

              {/* Name + set */}
              <Text style={styles.cardName}>{info.name || listing.cardId || "Card"}</Text>
              {(info.setName || info.number) && (
                <Text style={styles.cardMeta}>
                  {[info.setName, info.number ? `#${info.number}` : null].filter(Boolean).join(" · ")}
                </Text>
              )}
              {info.rarity ? <Text style={styles.cardRarity}>{info.rarity}</Text> : null}

              {/* Badges row */}
              <View style={styles.badgeRow}>
                {listing.condition && cond && (
                  <View style={[styles.badge, { backgroundColor: cond.color + "22", borderColor: cond.color + "55" }]}>
                    <View style={[styles.badgeDot, { backgroundColor: cond.color }]} />
                    <Text style={[styles.badgeText, { color: cond.color }]}>
                      {listing.condition} · {cond.label}
                    </Text>
                  </View>
                )}
                {listing.variation && listing.variation !== "Standard" && (
                  <View style={styles.badgeOutline}>
                    <Text style={styles.badgeOutlineText}>{listing.variation}</Text>
                  </View>
                )}
                {verified && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedTick}>✓</Text>
                    <Text style={styles.verifiedText}>Card verified</Text>
                  </View>
                )}
                {verified && listing.proofCode && (
                  <Pressable
                    onPress={() => proofImgSrc && setImgSlide(1)}
                    style={styles.codeChip}
                  >
                    <Text style={styles.codeChipText}>Code: {listing.proofCode}</Text>
                  </Pressable>
                )}
              </View>

              {/* Proof note */}
              {proofImgSrc && (
                <Pressable onPress={handleToggle} style={styles.proofNote}>
                  <Text style={styles.proofNoteIcon}>ℹ</Text>
                  <Text style={styles.proofNoteText}>
                    A proof photo has been submitted. Tap the card image (or here) to view it and verify the code appears written in the photo.
                  </Text>
                </Pressable>
              )}

              {/* Will Trade / Under Offer */}
              {(listing.willTrade || listing.pendingOfferCount > 0) && (
                <View style={styles.badgeRow}>
                  {listing.willTrade && (
                    <View style={styles.tradeBadge}>
                      <Text style={styles.tradeBadgeText}>
                        {isTradeOnly ? "⇄ Trade Only" : "⇄ Will Trade"}
                      </Text>
                    </View>
                  )}
                  {listing.pendingOfferCount > 0 && (
                    <View style={styles.offerBadge}>
                      <View style={styles.offerDot} />
                      <Text style={styles.offerBadgeText}>Under Offer</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Description */}
              {listing.description ? (
                <View style={styles.descBox}>
                  <Text style={styles.descLabel}>Seller notes</Text>
                  <Text style={styles.descText}>{listing.description}</Text>
                </View>
              ) : null}

              {/* Price + seller block */}
              <View style={styles.priceSellerBlock}>
                <View>
                  <Text style={styles.priceLabel}>{isTradeOnly ? "Listing type" : "Listed price"}</Text>
                  <Text style={[styles.priceValue, isTradeOnly && { color: "#a78bfa" }]}>
                    {isTradeOnly ? "Trade Only" : fmt(price, currency)}
                  </Text>
                </View>
                {seller.username && (
                  <View style={styles.sellerBlock}>
                    {seller.avatar ? (
                      <Image source={{ uri: seller.avatar }} style={styles.sellerAvatar} />
                    ) : (
                      <View style={styles.sellerAvatarFallback}>
                        <Text style={styles.sellerInitial}>{seller.username[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.sellerName}>{seller.username}</Text>
                    <SellerTierBadge
                      reputation={reputation}
                      size="sm"
                      onPress={reputation ? () => setShowReviews(true) : undefined}
                    />
                  </View>
                )}
              </View>

              {/* ── Action buttons ── */}
              {phase === "detail" && (
                <View style={styles.actions}>
                  {isTradeOnly ? (
                    <Pressable onPress={() => setShowTrade(true)} style={[styles.btnPrimary, { backgroundColor: "#7c3aed" }]}>
                      <Text style={styles.btnPrimaryText}>⇄ Propose a trade</Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable onPress={handleBuyNow} style={styles.btnPrimary}>
                        <Text style={styles.btnPrimaryText}>Buy now · {fmt(price, currency)}</Text>
                      </Pressable>
                      {listing.allowOffers && (
                        <Pressable onPress={() => setPhase("offer")} style={styles.btnSecondary}>
                          <Text style={styles.btnSecondaryText}>💬 Make an offer</Text>
                        </Pressable>
                      )}
                      {listing.willTrade && (
                        <Pressable onPress={() => setShowTrade(true)} style={[styles.btnSecondary, { borderColor: "#7c3aed" }]}>
                          <Text style={[styles.btnSecondaryText, { color: "#a78bfa" }]}>⇄ Propose a trade</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* ── Make offer form ── */}
              {phase === "offer" && (
                <View style={styles.actions}>
                  <Text style={styles.offerFormTitle}>Make an offer</Text>
                  <View style={styles.offerAmountWrap}>
                    <Text style={styles.currencySymbol}>£</Text>
                    <TextInput
                      style={styles.offerInput}
                      value={offerAmount}
                      onChangeText={setOfferAmount}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 4.99"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                  <TextInput
                    style={[styles.offerInput, styles.offerMsgInput]}
                    value={offerMessage}
                    onChangeText={setOfferMessage}
                    placeholder="Message (optional)"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                  {offerErr ? <Text style={styles.errText}>{offerErr}</Text> : null}
                  <Pressable
                    onPress={handleSendOffer}
                    disabled={offerLoading}
                    style={[styles.btnPrimary, offerLoading && { opacity: 0.5 }]}
                  >
                    {offerLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.btnPrimaryText}>Send offer</Text>
                    }
                  </Pressable>
                  <Pressable onPress={() => { setPhase("detail"); setOfferErr(""); }} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              )}

            </View>
          </ScrollView>
        )}

        {/* ── Lightbox overlay (absolute, within the modal — avoids nested Modal issues) ── */}
        {lightbox && proofImgSrc && (
          <Pressable style={styles.lightboxOverlay} onPress={() => setLightbox(false)}>
            {/* Inner pressable consumes touch so tapping the image/code doesn't close */}
            <Pressable style={styles.lightboxContent} onPress={() => {}}>
              <Pressable style={styles.lightboxClose} onPress={() => setLightbox(false)}>
                <Text style={styles.lightboxCloseText}>✕</Text>
              </Pressable>
              <Image
                source={{ uri: proofImgSrc }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
              <View style={styles.lightboxFooter}>
                <Text style={styles.lightboxHint}>
                  Check the handwritten code matches the listing code
                </Text>
                {listing.proofCode && (
                  <View style={styles.lightboxCodeBox}>
                    <Text style={styles.lightboxCodeText}>{listing.proofCode}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Pressable>
        )}

      </View>
    </Modal>

    <SellerReviewsSheet
      sellerId={seller.id}
      sellerUsername={seller.username}
      visible={showReviews}
      onClose={() => setShowReviews(false)}
    />

    <ProposeTradeSheet
      listing={listing}
      visible={showTrade}
      onClose={() => setShowTrade(false)}
    />

    <CheckoutSheet
      visible={showCheckout}
      listing={listing}
      onClose={() => setShowCheckout(false)}
      onSuccess={() => setShowCheckout(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 16,
    marginRight: 12,
  },
  doneText: { color: COLORS.accent, fontWeight: "600", fontSize: 15 },

  scroll: { paddingBottom: 40 },

  // Image panel
  imagePanel: {
    backgroundColor: "#111218",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 280,
  },
  imagePanelInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 44,
  },
  cardImage: { width: 200, height: 280, borderRadius: 12 },
  proofImage: { width: "100%", height: 260, borderRadius: 12 },
  noImage: {
    width: 150,
    height: 210,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    margin: 24,
  },
  noImageText: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
  enlargeHint: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  enlargeHintText: { color: "#fff", fontSize: 11, fontWeight: "500" },
  toggleLabel: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toggleLabelText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "500",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: "hidden",
  },

  // Detail content
  details: { padding: 16, gap: 12 },
  cardName: { color: COLORS.text, fontWeight: "800", fontSize: 20, lineHeight: 26 },
  cardMeta: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  cardRarity: { color: COLORS.textMuted, fontSize: 12 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeOutline: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeOutlineText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16,185,129,0.15)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.35)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifiedTick: { color: "#34d399", fontSize: 10, fontWeight: "800" },
  verifiedText: { color: "#34d399", fontSize: 11, fontWeight: "700" },
  codeChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  codeChipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },

  proofNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(16,185,129,0.06)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
    borderRadius: 12,
    padding: 10,
  },
  proofNoteIcon: { color: "#34d399", fontSize: 13, fontWeight: "700", marginTop: 1 },
  proofNoteText: { flex: 1, color: "rgba(52,211,153,0.75)", fontSize: 11, lineHeight: 16 },

  tradeBadge: {
    backgroundColor: "#7c3aed",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tradeBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  offerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.4)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fb923c" },
  offerBadgeText: { color: "#fb923c", fontSize: 11, fontWeight: "700" },

  descBox: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
  },
  descLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  descText: { color: COLORS.text, fontSize: 13, lineHeight: 19 },

  priceSellerBlock: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  priceValue: { color: COLORS.text, fontWeight: "800", fontSize: 26, letterSpacing: -0.5 },
  sellerBlock: { alignItems: "center", gap: 5 },
  sellerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  sellerAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.accent + "33",
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerInitial: { color: COLORS.accent, fontWeight: "800", fontSize: 14 },
  sellerName: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "600" },

  actions: { gap: 8 },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  btnSecondary: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: { color: COLORS.text, fontWeight: "700", fontSize: 14 },

  offerFormTitle: { color: COLORS.text, fontWeight: "700", fontSize: 15, marginBottom: 4 },
  offerAmountWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  currencySymbol: { color: COLORS.textMuted, fontSize: 16, marginRight: 6 },
  offerInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  offerMsgInput: {
    backgroundColor: COLORS.alt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 72,
  },
  errText: { color: COLORS.error, fontSize: 12 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "500" },

  successBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  successEmoji: { fontSize: 48 },
  successTitle: { color: COLORS.text, fontWeight: "800", fontSize: 22 },
  successSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  // Lightbox — absolute overlay inside the sheet modal
  lightboxOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.92)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  lightboxContent: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  lightboxClose: {
    position: "absolute",
    top: -52,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  lightboxImage: {
    width: "100%",
    height: 320,
    borderRadius: 16,
  },
  lightboxFooter: { alignItems: "center", gap: 8 },
  lightboxHint: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  lightboxCodeBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  lightboxCodeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 4,
  },
});
