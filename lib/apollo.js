// app/lib/apollo.js
import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import Constants from "expo-constants";
import { getToken } from "./auth";

const uri =
  process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT ??
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GRAPHQL_ENDPOINT;

console.log("GRAPHQL ENDPOINT =>", uri);

const httpLink = createHttpLink({ uri });

const authLink = setContext(async (_, { headers }) => {
  const token = await getToken();
  return { headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
