// graphql/localCollectionDocuments.js
// Local GraphQL documents that avoid problematic `cardId` selections inside cardsearch cards.

import { parse } from "graphql";

export const MyCollectionAppDocument = parse(`
  query MyCollectionApp {
    myCollection {
      id
      userId
      cardId
      quantity
      variation
      condition
      wishlist
      createdAt
      updatedAt
      card {
        id
        name
        setCode
        setName
        number
        image
        rarity
        images {
          small
          large
        }
        set {
          code
          name
          series
          releasedAt
        }
        variants {
          variant
          displayName
          key
          label
          default
        }
        latestPrices {
          variation
          provider
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
`);
