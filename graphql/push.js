// graphql/push.js — new backend returns Boolean! for push token mutations

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
    )
  }
`;

export const UNREGISTER_EXPO_PUSH_TOKEN = gql`
  mutation UnregisterExpoPushToken($expoPushToken: String!) {
    unregisterExpoPushToken(expoPushToken: $expoPushToken)
  }
`;
