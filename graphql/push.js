// app/graphql/push.js
//
// ADDED (2026-02-17)
// - Frontend GraphQL documents for push module mutations

import { gql } from "@apollo/client";

export const REGISTER_EXPO_PUSH_TOKEN = gql`
  mutation RegisterExpoPushToken(
    $expoPushToken: String!
    $platform: String
    $deviceName: String
    $appVersion: String
  ) {
    registerExpoPushToken(
      expoPushToken: $expoPushToken
      platform: $platform
      deviceName: $deviceName
      appVersion: $appVersion
    ) {
      ok
      error
    }
  }
`;

export const UNREGISTER_EXPO_PUSH_TOKEN = gql`
  mutation UnregisterExpoPushToken($expoPushToken: String!) {
    unregisterExpoPushToken(expoPushToken: $expoPushToken) {
      ok
      error
    }
  }
`;
