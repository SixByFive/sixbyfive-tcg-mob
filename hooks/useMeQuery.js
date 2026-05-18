import { useQuery } from "@apollo/client";
import { MeDocument } from "../graphql/documents";

export function useMeQuery(options) {
  return useQuery(MeDocument, options);
}
