// graphql/cardQueries.js

import { gql } from "@apollo/client";

export const CARD_BY_ID_STRING = gql`
  query CardById_String($id: String!) {
    card(id: $id) {
      id
      name
      number
      setName
      rarity
      image
      prices {
        variation
        tcgplayer
        cardmarket
        updatedAt
      }
    }
  }
`;

export const CARD_BY_ID_ID = gql`
  query CardById_ID($id: ID!) {
    card(id: $id) {
      id
      name
      number
      setName
      rarity
      image
      prices {
        variation
        tcgplayer
        cardmarket
        updatedAt
      }
    }
  }
`;

export const CARD_BY_ID_ALT = gql`
  query CardById_Alt($id: String!) {
    cardById(id: $id) {
      id
      name
      number
      setName
      rarity
      image
      prices {
        variation
        tcgplayer
        cardmarket
        updatedAt
      }
    }
  }
`;
