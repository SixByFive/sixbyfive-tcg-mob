// app/lib/apollo.js
import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";

const link = createHttpLink({
  uri: process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT, // set this in .env or app.json (extra)
});

export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});
