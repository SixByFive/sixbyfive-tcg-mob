// graphql/cardQueries.js
import { gql } from "@apollo/client";

/**
 * Backend field is `pricing`; we alias it to `prices` so the rest of the app
 * (InfoCard, getBestPrice, etc.) doesn’t need to change.
 */
export const CARD_BY_ID = gql`
  query CardById($id: ID!) {
    card(id: $id) {
      id
      name
      number
      set
      setName
      rarity
      image
      variations
      prices: pricing {
        variation
        tcgplayer
        cardmarket
        updatedAt
      }
    }
  }
`;
