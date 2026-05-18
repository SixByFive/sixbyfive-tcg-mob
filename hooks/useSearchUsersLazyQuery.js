import { useLazyQuery } from "@apollo/client";
import { SearchUsersDocument } from "../graphql/documents";

// Wraps useLazyQuery(SearchUsersDocument).
// The new backend uses variable name `q` (not `query`).
// Call as: runSearch({ variables: { q: "...", limit: 20 } })
export function useSearchUsersLazyQuery(options) {
  return useLazyQuery(SearchUsersDocument, options);
}
