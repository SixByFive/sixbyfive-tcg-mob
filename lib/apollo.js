// app/lib/apollo.js
import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import Constants from "expo-constants";
import { getToken } from "./auth";

// Optional (dev-only) verbose messages from Apollo
import { loadDevMessages, loadErrorMessages } from "@apollo/client/dev";
if (process.env.NODE_ENV !== "production") {
  loadDevMessages();
  loadErrorMessages();
}

const uri =
  process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT ??
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GRAPHQL_ENDPOINT;

console.log("GRAPHQL ENDPOINT =>", uri);

const httpLink = createHttpLink({ uri });

const authLink = setContext(async (_, { headers }) => {
  const token = await getToken();
  return { headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
});

// --- helpers used by the merge policy ---
function toNumberOrNull(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}
function ts(d) {
  if (!d) return 0;
  if (typeof d === "number" && Number.isFinite(d)) return d;
  const s = String(d);
  const m = s.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (m) {
    const [, yy, mm, dd] = m;
    return Date.UTC(+yy, +mm - 1, +dd);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}
function canonVar(v) {
  const k = String(v || "").toLowerCase().replace(/[\s_-]/g, "");
  if (k === "holo" || k === "holofoil" || k === "foil") return "holo";
  if (k === "reverse" || k === "reverseholo" || k === "reverseholofoil" || k === "rev") return "reverse";
  if (k === "normal" || k === "nonholo" || k === "nonfoil") return "normal";
  return k || "normal";
}

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      // Ensure Cards are normalized by id
      Card: {
        keyFields: ["id"],
        fields: {
          // Merge prices arrays instead of replacing them
          prices: {
            // no keyArgs so any args produce a single cache field we merge
            keyArgs: false,
            merge(existing = [], incoming = []) {
              // If the server sends nothing, keep what we already have
              if (!incoming || incoming.length === 0) {
                return existing ?? [];
              }

              const byVariation = new Map();

              const push = (row) => {
                if (!row) return;
                const v = canonVar(row.variation);
                // Normalize price keys (tcgplayer vs tcgPlayer, cardmarket vs cardMarket)
                const norm = {
                  ...row,
                  variation: v,
                  tcgplayer: toNumberOrNull(row.tcgplayer ?? row.tcgPlayer),
                  cardmarket: toNumberOrNull(row.cardmarket ?? row.cardMarket),
                };

                const prev = byVariation.get(v);
                if (!prev) {
                  byVariation.set(v, norm);
                  return;
                }

                // Prefer the one with the newer updatedAt; when equal, keep any non-null prices
                const newerFirst = ts(norm.updatedAt) - ts(prev.updatedAt);
                if (newerFirst > 0) {
                  // new row is newer → take it, but carry over non-null prices if missing
                  byVariation.set(v, {
                    ...norm,
                    tcgplayer: norm.tcgplayer ?? prev.tcgplayer,
                    cardmarket: norm.cardmarket ?? prev.cardmarket,
                  });
                } else if (newerFirst < 0) {
                  // old row is newer → keep prev, but fill gaps from incoming
                  byVariation.set(v, {
                    ...prev,
                    tcgplayer: prev.tcgplayer ?? norm.tcgplayer,
                    cardmarket: prev.cardmarket ?? norm.cardmarket,
                  });
                } else {
                  // same timestamp → prefer any non-null values
                  byVariation.set(v, {
                    ...prev,
                    ...norm,
                    tcgplayer: prev.tcgplayer ?? norm.tcgplayer,
                    cardmarket: prev.cardmarket ?? norm.cardmarket,
                  });
                }
              };

              (existing || []).forEach(push);
              (incoming || []).forEach(push);

              return Array.from(byVariation.values());
            },
          },
        },
      },

      // Good practice: stable pagination for the connection if you use it widely
      SearchCardsConnection: {
        fields: {
          edges: {
            keyArgs: false,
            merge(existing = [], incoming = []) {
              // Basic concat + dedupe by node.id
              const seen = new Set();
              const next = [];
              for (const e of [...existing, ...incoming]) {
                const id = e?.node?.id != null ? String(e.node.id) : null;
                const key = id || e?.cursor || Math.random().toString(36);
                if (seen.has(key)) continue;
                seen.add(key);
                next.push(e);
              }
              return next;
            },
          },
        },
      },
    },
  }),
});
