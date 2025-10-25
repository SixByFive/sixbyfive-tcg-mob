// graphql/binders.temp.js
import { gql } from "@apollo/client";

/** List tiles: enough to render cover, name, and counts without per-binder hydration. */
export const MY_BINDERS_SAFE = gql`
  query MyBinders_Safe {
    myBinders {
      id
      name
      coverColor
      accentColor
      pages {
        id
        pageOrder
        layout
        slots { id cardId position quantity }
      }
    }
  }
`;

/** Single binder for view/edit screens. Keep it minimal and schema-safe. */
export const BINDER_SAFE = gql`
  query Binder_Safe($id: ID!) {
    binder(id: $id) {
      id
      name
      coverColor
      accentColor
      pages {
        id
        title
        pageOrder
        layout
        slots { id cardId position quantity notes }
      }
    }
  }
`;
