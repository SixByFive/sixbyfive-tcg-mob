// graphql/collectionQueries.js

import { gql } from "@apollo/client";

export const COLLECTION_Q = gql`
  query CollectionTab {
    me {
      id
      username
      stats {
        cards
        binders
        wishlist
      }
      binders {
        id
        name
        count
        coverImage
        updatedAt
      }
      recentBinders {
        id
        name
        count
        coverImage
        updatedAt
      }
    }
  }
`;
