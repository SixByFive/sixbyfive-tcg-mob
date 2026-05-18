// graphql/localCollectionDocuments.js

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
        cardId
        name
        number
        setCode
        rarity
        images {
          small
          large
        }
        set {
          code
          name
        }
        variants {
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
