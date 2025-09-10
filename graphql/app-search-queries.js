// graphql/app-search-queries.js
import { gql } from "@apollo/client";

/**
 * Search cards with Relay-style connection and include per-card prices.
 * - Matches your server's SearchCardsInput
 * - Adds a selectable `prices` block (guarded with @include, default true)
 */
export const SEARCH_CARDS_CONN_WITH_PRICES = gql`
  query SearchCardsConnection(
    $input: SearchCardsInput!
    $includePrices: Boolean = true
  ) {
    searchCardsConnection(input: $input) {
      totalCount
      edges {
        cursor
        node {
          id
          name
          set
          setName
          number
          image
          rarity
          prices @include(if: $includePrices) {
            variation
            gbp
            tcgplayer
            cardmarket
            currency
            updatedAt
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
