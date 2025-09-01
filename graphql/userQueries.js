// graphql/userQueries.js
// User/Profile queries for the app.
// - USER_PROFILE: fetch a public profile by username
// - SEARCH_USERS: search profiles by query (optionally limit results)
//
// Notes:
// • Profile has both `id` (PK, good for Apollo cache) and `userId` (FK to User).
// • Nested `user { ... }` is a User object and does NOT have `userId` in the schema.

import { gql } from "@apollo/client";

/**
 * Fetch a public user profile by username.
 * Keeps Profile.id for cache normalization and Profile.userId for linking to User.
 */
export const USER_PROFILE = gql`
  query UserProfile($username: String!) {
    userProfile(username: $username) {
      id
      userId
      bio
      favouritePokemon
      avatar
      status
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

/**
 * Search users (profiles) by a text query.
 * Returns a lightweight shape ideal for list rows.
 */
export const SEARCH_USERS = gql`
  query SearchUsers($query: String!, $limit: Int) {
    searchUsers(query: $query, limit: $limit) {
      id
      userId
      avatar
      user {
        id
        username
        avatar
      }
    }
  }
`;

export const ME = gql`
  query Me {
    me {
      id
      username
      avatar
      emailVerified
      subscription {
        planName
        renewalDateRelative
      }
      recentBinders { id name pages updatedAtRelative }
      watchlistPreview { id name set price change }
      recentActivity { id title timestampRelative }
    }
  }
`;