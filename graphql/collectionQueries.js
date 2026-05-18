// graphql/collectionQueries.js

import { gql } from "@apollo/client";

export const COLLECTION_Q = gql`
  query CollectionTab {
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
        }
      }
    }
  }
`;
