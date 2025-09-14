// NEW: exact query you provided, wrapped for Apollo use.
import { gql } from "@apollo/client";

export const GET_USER_ACHIEVEMENTS = gql`
  query GetUserAchievements($userId: ID!) {
    userAchievements(userId: $userId) {
      id
      earnedAt
      achievement {
        id
        code
        name
        description
        tier
        iconUrl
        createdAt
        updatedAt
      }
    }
  }
`;
