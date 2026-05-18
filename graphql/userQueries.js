// graphql/userQueries.js

import { gql } from "@apollo/client";

export const USER_PROFILE = gql`
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

export const SEARCH_USERS = gql`
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

export const ME = gql`
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
      discordId
      discordUsername
      lastLogin
      createdAt
      updatedAt
    }
  }
`;
