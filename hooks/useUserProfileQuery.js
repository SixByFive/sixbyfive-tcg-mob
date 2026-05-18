import { useQuery } from "@apollo/client";
import { UserProfileDocument } from "../graphql/documents";

export function useUserProfileQuery(options) {
  return useQuery(UserProfileDocument, options);
}
