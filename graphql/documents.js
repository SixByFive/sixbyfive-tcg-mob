// graphql/documents.js
// Local GQL documents for the new tcg-runtime backend (gateway on port 4010).
// Replaces all @sixbyfive/tcg-binder document imports throughout the app.

import { gql } from "@apollo/client";

// ── Auth ─────────────────────────────────────────────────────────────────────

export const LoginDocument = gql`
  mutation Login($email: String, $username: String, $password: String!, $mfaToken: String) {
    login(email: $email, username: $username, password: $password, mfaToken: $mfaToken) {
      token
      refreshToken
      user {
        id
        username
        email
        emailVerified
        isAdmin
        avatar
        mfaEnabled
        twoFactorEnabled
        chatBanned
        restrictionLevel
        oauthProvider
        createdAt
      }
    }
  }
`;

export const RegisterDocument = gql`
  mutation Register($username: String!, $email: String!, $password: String!, $referrerId: ID) {
    register(username: $username, email: $email, password: $password, referrerId: $referrerId) {
      token
      user {
        id
        username
        email
        emailVerified
      }
    }
  }
`;

export const RequestPasswordResetDocument = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export const ResetPasswordDocument = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword)
  }
`;

// ── Me ───────────────────────────────────────────────────────────────────────

export const MeDocument = gql`
  query Me {
    me {
      id
      username
      email
      emailVerified
      isAdmin
      chatBanned
      restrictionLevel
      mfaEnabled
      twoFactorEnabled
      avatar
      oauthProvider
      oauthId
      discordId
      discordUsername
      lastLogin
      createdAt
      updatedAt

      cardsPreview {
        id
        cardId
        quantity
        card { id name images { small } }
      }
      wishlistPreview {
        id
        cardId
        card { id name images { small } }
      }
      forSalePreview {
        id
        title
        price
        currency
        listingKind
        willTrade
        cardInfo { id name imageSmall }
      }
      forTradePreview {
        id
        title
        price
        currency
        listingKind
        cardInfo { id name imageSmall }
      }
    }
  }
`;

// ── Card search ───────────────────────────────────────────────────────────────

export const SearchCardsDocument = gql`
  query SearchCards($input: CardSearchInput!) {
    searchCards(input: $input) {
      total
      limit
      offset
      items {
        id
        cardId
        name
        number
        setCode
        rarity
        images { small large }
        set { code name }
        variants { key label default }
        latestPrices {
          variation
          currency
          gbp
          market
          mid
          low
          high
          updatedAt
          provider
        }
      }
    }
  }
`;

export const CardByIdDocument = gql`
  query CardById($id: ID!) {
    cardsearchCard(id: $id) {
      id
      cardId
      name
      number
      setCode
      rarity
      images { small large }
      set { code name }
      variants { key label default }
      latestPrices {
        variation
        currency
        gbp
        market
        mid
        low
        high
        updatedAt
        provider
      }
    }
  }
`;

// ── Sets ──────────────────────────────────────────────────────────────────────

export const SearchSetsDocument = gql`
  query SearchSets($limit: Int, $offset: Int) {
    cardsearchSets(limit: $limit, offset: $offset) {
      code
      abbr
      name
      series
      releasedAt
      lang
      total
    }
  }
`;

// ── Collection ────────────────────────────────────────────────────────────────

export const MyCollectionDocument = gql`
  query MyCollection {
    myCollection {
      id
      userId
      cardId
      quantity
      condition
      variation
      wishlist
      createdAt
      updatedAt
      card {
        id
        cardId
        name
        number
        setCode
        rarity
        images { small large }
        set { code name }
        variants { key label default }
        latestPrices {
          variation
          currency
          gbp
          market
          mid
          low
          high
          updatedAt
          provider
        }
      }
    }
  }
`;

export const AddToCollectionDocument = gql`
  mutation AddToCollection($cardId: String!, $quantity: Int, $condition: String, $variation: String) {
    addToCollection(cardId: $cardId, quantity: $quantity, condition: $condition, variation: $variation) {
      id
      userId
      cardId
      quantity
      condition
      variation
      wishlist
      createdAt
      updatedAt
    }
  }
`;

export const UpdateCollectionEntryDocument = gql`
  mutation UpdateCollectionEntry($cardId: String!, $quantity: Int, $condition: String, $variation: String) {
    updateCollectionEntry(cardId: $cardId, quantity: $quantity, condition: $condition, variation: $variation) {
      id
      userId
      cardId
      quantity
      condition
      variation
      wishlist
      createdAt
      updatedAt
    }
  }
`;

export const RemoveFromCollectionDocument = gql`
  mutation RemoveFromCollection($cardId: String!, $variation: String) {
    removeFromCollection(cardId: $cardId, variation: $variation)
  }
`;

export const MoveToWishlistDocument = gql`
  mutation MoveToWishlist($cardId: String!, $variation: String) {
    moveToWishlist(cardId: $cardId, variation: $variation)
  }
`;

// ── Wishlist ──────────────────────────────────────────────────────────────────

export const AddToWishlistDocument = gql`
  mutation AddToWishlist($cardId: String!, $variation: String, $quantity: Int, $notes: String, $status: WishlistStatus) {
    addToWishlist(cardId: $cardId, variation: $variation, quantity: $quantity, notes: $notes, status: $status) {
      id
      userId
      cardId
      quantity
      variation
      notes
      status
      addedAt
      createdAt
      updatedAt
    }
  }
`;

export const RemoveFromWishlistDocument = gql`
  mutation RemoveFromWishlist($cardId: String!, $variation: String) {
    removeFromWishlist(cardId: $cardId, variation: $variation)
  }
`;

// ── Binders ───────────────────────────────────────────────────────────────────

export const MyBindersDocument = gql`
  query MyBinders {
    myBinders {
      id
      userId
      name
      description
      coverColor
      accentColor
      visibility
      slug
      isDeleted
      createdAt
      updatedAt
      pages {
        id
        binderId
        title
        layout
        pageOrder
        createdAt
        updatedAt
        slots { id pageId cardId quantity position notes }
      }
    }
  }
`;

export const BinderDocument = gql`
  query Binder($id: ID, $slug: String) {
    binder(id: $id, slug: $slug) {
      id
      userId
      name
      description
      coverColor
      accentColor
      visibility
      slug
      isDeleted
      createdAt
      updatedAt
      pages {
        id
        binderId
        title
        layout
        pageOrder
        createdAt
        updatedAt
        slots { id pageId cardId quantity position notes }
      }
    }
  }
`;

// ── Users / Profiles ──────────────────────────────────────────────────────────

export const UserProfileDocument = gql`
  query UserProfile($username: String!) {
    userProfile(username: $username) {
      id
      userId
      bio
      favouritePokemon
      avatar
      country
      status
      publicProfile
      wantsTrade
      wantsMarketplace
      user {
        id
        username
        email
        avatar
        emailVerified
        lastLogin
        createdAt
        updatedAt
      }
    }
  }
`;

export const SearchUsersDocument = gql`
  query SearchUsers($q: String!, $limit: Int) {
    searchUsers(q: $q, limit: $limit) {
      id
      username
      avatar
      bio
      country
      createdAt
    }
  }
`;

// ── Profile mutations ─────────────────────────────────────────────────────────

export const UpdateProfileDocument = gql`
  mutation UpdateProfile(
    $bio: String
    $favouritePokemon: String
    $avatar: String
    $country: String
    $status: String
    $publicProfile: Boolean
    $wantsTrade: Boolean
    $wantsMarketplace: Boolean
    $address1: String
    $address2: String
    $city: String
    $postcode: String
    $state: String
    $phone: String
    $discord: String
  ) {
    updateProfile(
      bio: $bio
      favouritePokemon: $favouritePokemon
      avatar: $avatar
      country: $country
      status: $status
      publicProfile: $publicProfile
      wantsTrade: $wantsTrade
      wantsMarketplace: $wantsMarketplace
      address1: $address1
      address2: $address2
      city: $city
      postcode: $postcode
      state: $state
      phone: $phone
      discord: $discord
    ) {
      id
      userId
      bio
      favouritePokemon
      avatar
      country
      status
      publicProfile
      wantsTrade
      wantsMarketplace
    }
  }
`;

// ── Binder mutations ──────────────────────────────────────────────────────────

export const CreateBinderDocument = gql`
  mutation CreateBinder($input: BinderInput!) {
    createBinder(input: $input) {
      id userId name description coverColor accentColor visibility slug isDeleted createdAt updatedAt
      pages { id binderId title layout pageOrder slots { id pageId cardId quantity position notes } }
    }
  }
`;

export const UpdateBinderDocument = gql`
  mutation UpdateBinder($id: ID!, $input: BinderInput!) {
    updateBinder(id: $id, input: $input) {
      id userId name description coverColor accentColor visibility slug isDeleted createdAt updatedAt
    }
  }
`;

export const DeleteBinderDocument = gql`
  mutation DeleteBinder($id: ID!, $permanent: Boolean) {
    deleteBinder(id: $id, permanent: $permanent)
  }
`;

export const SaveBinderPagesAndSlotsDocument = gql`
  mutation SaveBinderPagesAndSlots($binderId: ID!, $pages: [BinderPageInput!]!) {
    saveBinderPagesAndSlots(binderId: $binderId, pages: $pages) {
      id userId name
      pages {
        id binderId title layout pageOrder
        slots { id pageId cardId quantity position notes }
      }
    }
  }
`;

export const AddBinderPageDocument = gql`
  mutation AddBinderPage($binderId: ID!, $input: BinderPageInput!) {
    addBinderPage(binderId: $binderId, input: $input) {
      id binderId title layout pageOrder
      slots { id pageId cardId quantity position notes }
    }
  }
`;

export const AddCardToBinderDocument = gql`
  mutation AddCardToBinder($pageId: ID!, $input: BinderSlotInput!) {
    addCardToBinder(pageId: $pageId, input: $input) {
      id pageId cardId quantity position notes
    }
  }
`;

export const BrowseBindersDocument = gql`
  query BrowseBinders($page: Int, $pageSize: Int, $userId: ID, $search: String) {
    browseBinders(page: $page, pageSize: $pageSize, userId: $userId, search: $search) {
      binders {
        id userId name description coverColor accentColor visibility slug isDeleted createdAt updatedAt
      }
      total page pageSize
    }
  }
`;

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const SubscriptionPlansDocument = gql`
  query SubscriptionPlans {
    subscriptionPlans {
      id
      name
      description
      price
      currency
      interval
      platformFeePercent
      feeDiscount
      maxBinders
      maxActiveListings
      maxActiveTrades
      featuresJson
      stripePriceIdMonthly
      stripePriceIdYearly
      active
      sortOrder
    }
  }
`;

export const MySubscriptionDocument = gql`
  query MySubscription {
    mySubscription {
      id
      status
      cancelAtPeriodEnd
      currentPeriodStart
      currentPeriodEnd
      cancelledAt
      plan {
        id
        name
        price
        currency
        interval
      }
    }
  }
`;

export const MyCapabilitiesDocument = gql`
  query MyCapabilities {
    myCapabilities {
      planName
      platformFeePercent
      maxBinders
      maxActiveListings
      maxActiveTrades
    }
  }
`;

export const SubscriptionPortalDocument = gql`
  query SubscriptionPortal {
    subscriptionPortal {
      url
    }
  }
`;

export const CreateSubscriptionDocument = gql`
  mutation CreateSubscription($planId: ID!) {
    createSubscription(planId: $planId) {
      url
      sessionId
    }
  }
`;

export const CancelSubscriptionDocument = gql`
  mutation CancelSubscription {
    cancelSubscription
  }
`;

export const ResumeSubscriptionDocument = gql`
  mutation ResumeSubscription {
    resumeSubscription {
      id
      status
      cancelAtPeriodEnd
      currentPeriodEnd
    }
  }
`;

export const UpdateSubscriptionDocument = gql`
  mutation UpdateSubscription($planId: ID!) {
    updateSubscription(planId: $planId) {
      id
      status
      cancelAtPeriodEnd
      currentPeriodStart
      currentPeriodEnd
      plan {
        id
        name
        price
        interval
      }
    }
  }
`;

// ── Marketplace ───────────────────────────────────────────────────────────────

const CARD_LISTING_FIELDS = `
  id
  cardId
  price
  currency
  condition
  variation
  description
  willTrade
  allowOffers
  moderationResult
  proofCode
  proofImageUrl
  pendingOfferCount
  status
  seller { id username avatar }
  cardInfo { id name number rarity setName imageSmall imageLarge }
`;

export const PublicListingsDocument = gql`
  query PublicListings($sellerId: ID!, $limit: Int) {
    listings(sellerId: $sellerId, status: ACTIVE, limit: $limit) {
      ... on CardListing {
        id
        cardId
        condition
        variant
        price
        currency
        quantity
        status
        allowOffers
        willTrade
        createdAt
        cardInfo { name imageSmall setName number }
        seller { id username avatar }
      }
    }
  }
`;

export const BrowseListingsDocument = gql`
  query BrowseListings($limit: Int, $offset: Int, $condition: String, $sort: String) {
    listings(status: ACTIVE, limit: $limit, offset: $offset, condition: $condition, sort: $sort) {
      ... on CardListing {
        ${CARD_LISTING_FIELDS}
      }
    }
  }
`;

export const MyMarketListingsDocument = gql`
  query MyMarketListings($limit: Int, $offset: Int) {
    myListings(limit: $limit, offset: $offset) {
      id
      cardId
      price
      currency
      condition
      variation
      willTrade
      status
      moderationResult
      proofCode
      pendingOfferCount
      cardInfo { id name number rarity setName imageSmall imageLarge }
    }
  }
`;

export const CreateMarketOfferDocument = gql`
  mutation CreateMarketOffer($listingId: ID!, $amount: Float!, $message: String) {
    createOffer(listingId: $listingId, amount: $amount, message: $message) {
      id amount status createdAt
    }
  }
`;

export const MarketplaceRulesDocument = gql`
  query MarketplaceRules {
    marketplaceRules
  }
`;

export const HasAgreedToMarketplaceRulesDocument = gql`
  query HasAgreedToMarketplaceRules {
    hasAgreedToMarketplaceRules
  }
`;

export const AgreeToMarketplaceRulesDocument = gql`
  mutation AgreeToMarketplaceRules {
    agreeToMarketplaceRules
  }
`;

export const SellerReputationDocument = gql`
  query SellerReputation($userId: ID!) {
    sellerReputation(userId: $userId) {
      score positive negative neutral completedMarketplace
    }
  }
`;

export const SellerReviewsDocument = gql`
  query SellerReviews($userId: ID!, $limit: Int, $offset: Int) {
    sellerReputation(userId: $userId) {
      score positive negative neutral completedMarketplace
    }
    sellerReviews(userId: $userId, limit: $limit, offset: $offset) {
      cardId rating review createdAt
    }
  }
`;

export const MyWalletDocument = gql`
  query MyWallet {
    myWallet(limit: 1) {
      balance
      held
      currency
    }
  }
`;

export const QuoteTradeShippingDocument = gql`
  query QuoteTradeShipping($id: ID!) {
    quoteTradeShipping(id: $id) {
      amountPence
      amount
      currency
      carrier
      service
    }
  }
`;

export const SetTradeShippingAddressDocument = gql`
  mutation SetTradeShippingAddress($id: ID!, $address: JSON!) {
    setTradeShippingAddress(id: $id, address: $address)
  }
`;

export const ShipTradeDocument = gql`
  mutation ShipTrade($id: ID!, $parcelSize: String) {
    shipTrade(id: $id, parcelSize: $parcelSize) {
      ok
      trackingNumber
      trackingUrl
      labelUrl
      carrier
      service
    }
  }
`;

export const MyTradesDocument = gql`
  query MyTrades($status: TradeStatus) {
    myTrades(status: $status) {
      id
      status
      createdAt
      initiatorId
      partyAId
      partyBId
      topUpAmount
      addressASet
      addressBSet
      trackingNumberA
      trackingNumberB
      cards { cardId userId quantity condition variation }
    }
  }
`;

export const InitiateTradeDocument = gql`
  mutation InitiateTrade(
    $userId: ID!
    $offeredCards: [TradeCardInput!]
    $wantedCards: [TradeCardInput!]
    $topUpAmount: Float
  ) {
    initiateTrade(
      userId: $userId
      offeredCards: $offeredCards
      wantedCards: $wantedCards
      topUpAmount: $topUpAmount
    ) {
      id status createdAt
    }
  }
`;

export const MyCollectionForTradeDocument = gql`
  query MyCollectionForTrade {
    myCollection {
      id
      cardId
      quantity
      condition
      variation
      card {
        id name number rarity
        images { small large }
        set { name }
      }
    }
  }
`;

export const MyCollectionForListingDocument = gql`
  query MyCollectionForListing {
    myCollection {
      cardId
      quantity
      condition
      variation
      card {
        id name number rarity
        set { name releaseDate }
        images { small large }
      }
    }
  }
`;

export const PriceSuggestionDocument = gql`
  query PriceSuggestion($cardId: String!) {
    listings(type: CARD, status: ACTIVE, cardId: $cardId, limit: 30) {
      ... on CardListing { price condition }
    }
  }
`;

export const CreateListingDocument = gql`
  mutation CreateListing($input: CreateListingInput!) {
    createListing(input: $input) {
      id cardId price currency condition variation status createdAt
    }
  }
`;

// Bulk-lot sale — one listing representing a whole lot (tracked from the
// seller's collection or a seller-declared random lot).
export const CreateBulkLotDocument = gql`
  mutation CreateBulkLot($input: CreateBulkLotInput!) {
    createBulkLot(input: $input) {
      id
      listingKind
      title
      cardCount
      status
      proofCode
      proofCodeExpiresAt
      createdAt
    }
  }
`;

export const SubmitListingProofDocument = gql`
  mutation SubmitListingProof($id: ID!, $image: String!) {
    submitListingProof(id: $id, image: $image) {
      ok
      result
      newProofCode
    }
  }
`;

export const DeleteListingDocument = gql`
  mutation DeleteListing($id: ID!) {
    deleteListing(id: $id)
  }
`;

export const UpdateListingDocument = gql`
  mutation UpdateListing($id: ID!, $input: UpdateListingInput!) {
    updateListing(id: $id, input: $input) {
      id
      price
      quantity
      status
    }
  }
`;

// ── Offers ────────────────────────────────────────────────────────────────────

export const MyIncomingOffersDocument = gql`
  query MyIncomingOffers {
    myIncomingOffers {
      id
      listingId
      buyerId
      amount
      message
      status
      expiresAt
      respondedAt
      counterAmount
      counterMessage
      createdAt
      buyer { id username avatar }
      listing {
        ... on CardListing {
          id
          price
          cardInfo { name imageSmall setName }
        }
      }
    }
  }
`;

export const MyOffersDocument = gql`
  query MyOffers {
    myOffers {
      id
      listingId
      buyerId
      amount
      message
      status
      expiresAt
      respondedAt
      counterAmount
      counterMessage
      createdAt
      listing {
        ... on CardListing {
          id
          price
          cardInfo { name imageSmall setName }
          seller { id username }
        }
      }
    }
  }
`;

export const RespondToOfferDocument = gql`
  mutation RespondToOffer(
    $offerId: ID!
    $action: String!
    $counterAmount: Float
    $counterMessage: String
  ) {
    respondToOffer(
      offerId: $offerId
      action: $action
      counterAmount: $counterAmount
      counterMessage: $counterMessage
    ) {
      ok
      status
      orderId
      totalAmount
      counterAmount
    }
  }
`;

export const WithdrawOfferDocument = gql`
  mutation WithdrawOffer($offerId: ID!) {
    withdrawOffer(offerId: $offerId)
  }
`;

// ── Orders ────────────────────────────────────────────────────────────────────

export const MyOrdersDocument = gql`
  query MyOrders($role: String, $limit: Int) {
    myOrders(role: $role, limit: $limit) {
      id
      orderNumber
      totalAmount
      salePrice
      shippingCost
      currency
      paymentStatus
      fulfilmentStatus
      trackingNumber
      trackingCarrier
      buyerId
      sellerId
      createdAt
      shippedAt
      completedAt
      cancelledAt
      buyer { id username avatar }
      seller { id username avatar }
      listing {
        ... on CardListing {
          id
          cardInfo { name imageSmall setName }
        }
      }
    }
  }
`;

export const ShipOrderDocument = gql`
  mutation ShipOrder($id: ID!) {
    shipOrder(id: $id) {
      ok
      trackingNumber
      trackingUrl
      labelUrl
      carrier
      service
    }
  }
`;

export const ConfirmOrderReceivedDocument = gql`
  mutation ConfirmOrderReceived($id: ID!) {
    confirmOrderReceived(id: $id) {
      id
      fulfilmentStatus
      paymentStatus
      completedAt
    }
  }
`;

export const RaiseOrderDisputeDocument = gql`
  mutation RaiseOrderDispute($id: ID!, $reason: String!) {
    raiseOrderDispute(id: $id, reason: $reason) {
      id
      fulfilmentStatus
    }
  }
`;

export const CancelOrderDocument = gql`
  mutation CancelOrder($id: ID!, $reason: String) {
    cancelOrder(id: $id, reason: $reason) {
      id
      fulfilmentStatus
      paymentStatus
      cancelledAt
    }
  }
`;

export const LeaveOrderFeedbackDocument = gql`
  mutation LeaveOrderFeedback($id: ID!, $rating: Int!, $review: String) {
    leaveOrderFeedback(id: $id, rating: $rating, review: $review)
  }
`;

export const ConfirmTradeReceivedDocument = gql`
  mutation ConfirmTradeReceived($id: ID!) {
    confirmTradeReceived(id: $id) {
      id
      status
    }
  }
`;

export const RaiseTradeDisputeDocument = gql`
  mutation RaiseTradeDispute($id: ID!, $reason: String!) {
    raiseTradeDispute(id: $id, reason: $reason) {
      dispute { id status }
      trade { id status }
    }
  }
`;

export const LeaveTradeFleedbackDocument = gql`
  mutation LeaveTradeFeedback($id: ID!, $rating: Int!, $review: String) {
    leaveTradeFeedback(id: $id, rating: $rating, review: $review)
  }
`;

// ── Seller setup ──────────────────────────────────────────────────────────────

export const SellerStatusDocument = gql`
  query SellerStatus {
    sellerStatus {
      connected
      complete
      url
    }
  }
`;

export const SellerAddressDocument = gql`
  query SellerAddress {
    sellerAddress {
      name
      line1
      line2
      city
      postcode
      country
      phone
      email
    }
  }
`;

export const UpdateSellerAddressDocument = gql`
  mutation UpdateSellerAddress($input: SellerAddressInput!) {
    updateSellerAddress(input: $input)
  }
`;

export const ConnectStripeDocument = gql`
  mutation ConnectStripe {
    connectStripe {
      accountId
      url
      alreadyConnected
    }
  }
`;

export const CreateTopupIntentDocument = gql`
  mutation CreateTopupIntent($amountPence: Int!) {
    createTopupIntent(amountPence: $amountPence) {
      clientSecret
      paymentIntentId
    }
  }
`;

export const ConfirmTopupDocument = gql`
  mutation ConfirmTopup($paymentIntentId: String!) {
    confirmTopup(paymentIntentId: $paymentIntentId) {
      balance
      currency
    }
  }
`;

// ── Wallet history & withdrawal ───────────────────────────────────────────────

export const WalletDetailDocument = gql`
  query WalletDetail($limit: Int, $offset: Int) {
    myWallet(limit: $limit, offset: $offset) {
      balance
      held
      currency
      total
      transactions {
        id
        type
        amount
        currency
        status
        description
        relatedTradeId
        createdAt
      }
    }
  }
`;

export const RequestWithdrawalDocument = gql`
  mutation RequestWithdrawal(
    $amountPence: Int!
    $sortCode: String!
    $accountNumber: String!
    $accountName: String
  ) {
    requestWithdrawal(
      amountPence: $amountPence
      sortCode: $sortCode
      accountNumber: $accountNumber
      accountName: $accountName
    ) {
      id
      amount
      status
      description
      createdAt
    }
  }
`;

// ── Notifications ─────────────────────────────────────────────────────────────

export const MyNotificationsDocument = gql`
  query MyNotifications($page: Int, $pageSize: Int) {
    myNotifications(page: $page, pageSize: $pageSize) {
      notifications {
        id
        type
        title
        body
        isRead
        isDismissed
        createdAt
      }
      total
      page
      pageSize
    }
  }
`;

export const UnreadNotificationCountDocument = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const MarkNotificationReadDocument = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id)
  }
`;

export const MarkAllNotificationsReadDocument = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export const DismissNotificationDocument = gql`
  mutation DismissNotification($id: ID!) {
    dismissNotification(id: $id)
  }
`;

// ── Price Alerts ──────────────────────────────────────────────────────────────

export const MyPriceAlertsDocument = gql`
  query MyPriceAlerts {
    myPriceAlerts {
      id
      cardId
      variation
      condition
      currency
      value
      windowHours
      cooldownHours
      isActive
      lastFiredAt
      createdAt
    }
  }
`;

export const UpsertPriceAlertDocument = gql`
  mutation UpsertPriceAlert($input: UpsertPriceAlertInput!) {
    upsertPriceAlert(input: $input) {
      id
      cardId
      variation
      condition
      currency
      value
      windowHours
      cooldownHours
      isActive
      createdAt
    }
  }
`;

export const DeletePriceAlertDocument = gql`
  mutation DeletePriceAlert($id: ID!) {
    deletePriceAlert(id: $id)
  }
`;

export const TogglePriceAlertDocument = gql`
  mutation TogglePriceAlert($id: ID!, $active: Boolean!) {
    togglePriceAlert(id: $id, active: $active)
  }
`;

// ── Notification preferences ─────────────────────────────────────────────────

export const MyNotificationPrefsDocument = gql`
  query MyNotificationPrefs {
    myNotificationPrefs {
      inappEnabled
      emailEnabled
      pushEnabled
      digest
      quietStart
      quietEnd
    }
  }
`;

export const SetNotificationPrefsDocument = gql`
  mutation SetNotificationPrefs(
    $inappEnabled: Boolean
    $emailEnabled: Boolean
    $pushEnabled: Boolean
    $digest: String
    $quietStart: String
    $quietEnd: String
  ) {
    setNotificationPrefs(
      inappEnabled: $inappEnabled
      emailEnabled: $emailEnabled
      pushEnabled: $pushEnabled
      digest: $digest
      quietStart: $quietStart
      quietEnd: $quietEnd
    )
  }
`;

// ── Privacy / account ─────────────────────────────────────────────────────────

export const DeleteAccountDocument = gql`
  mutation DeleteAccount($password: String, $confirm: String!) {
    deleteAccount(password: $password, confirm: $confirm)
  }
`;

// ── Checkout ──────────────────────────────────────────────────────────────────

export const WalletBalanceDocument = gql`
  query WalletBalance {
    myWallet(limit: 0) {
      balance
      currency
    }
  }
`;

export const CreateCartOrdersDocument = gql`
  mutation CreateCartOrders($items: [CartItemInput!]!, $walletAmountPence: Int) {
    createCartOrders(items: $items, walletAmountPence: $walletAmountPence) {
      orders {
        id
        clientSecret
        salePrice
        totalAmount
        currency
        walletAmountPence
      }
      errors {
        listingId
        error
      }
    }
  }
`;
