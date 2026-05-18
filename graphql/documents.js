// graphql/documents.js
// Local GQL documents for the new tcg-runtime backend (gateway on port 4010).
// Replaces all @sixbyfive/tcg-binder document imports throughout the app.

import { gql } from "@apollo/client";

// ── Auth ─────────────────────────────────────────────────────────────────────

export const LoginDocument = gql`
  mutation Login($email: String, $username: String, $password: String!, $mfaToken: String) {
    login(email: $email, username: $username, password: $password, mfaToken: $mfaToken) {
      token
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
