// graphql/cardQueries.js — new backend uses cardsearchCard

import { gql } from "@apollo/client";

export const CARD_BY_ID = gql`
  query CardById($id: ID!) {
    cardsearchCard(id: $id) {
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
        provider
      }
    }
  }
`;
