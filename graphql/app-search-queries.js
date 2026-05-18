// graphql/app-search-queries.js — new backend uses searchCards (non-connection)

import { gql } from "@apollo/client";

export const SEARCH_CARDS_CONN_WITH_PRICES = gql`
  query SearchCardsConnection(
    $input: CardSearchInput!
  ) {
    searchCards(input: $input) {
      total
      limit
      offset
      items {
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
  }
`;
