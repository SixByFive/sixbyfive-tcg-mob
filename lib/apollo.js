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

// ✅ pull from expo extra (app.json)
const extra = Constants.expoConfig?.extra || {};
const DEV_MODE = !!extra.EXPO_PUBLIC_DEV_MODE;

// ✅ endpoints (prefer expo extra; env fallback for safety)
const PROD_GRAPHQL =
  extra.EXPO_PUBLIC_GRAPHQL_ENDPOINT ||
  process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT;

const DEV_GRAPHQL = extra.EXPO_PUBLIC_GRAPHQL_ENDPOINT_LOCAL || PROD_GRAPHQL;

if (__DEV__) {
  console.log("GRAPHQL PROD =>", PROD_GRAPHQL);
  console.log("GRAPHQL DEV  =>", DEV_GRAPHQL);
  console.log("DEV_MODE     =>", DEV_MODE);
}

// --- create HTTP links ---
const prodHttpLink = createHttpLink({ uri: PROD_GRAPHQL });
const devHttpLink = createHttpLink({ uri: DEV_GRAPHQL });

// --- auth link ---
const authLink = setContext(async (_, { headers }) => {
  const token = await getToken();
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

// All operations route through the single gateway — no per-service splitting.
function buildRoutedLink() {
  const httpLink = DEV_MODE ? devHttpLink : prodHttpLink;
  if (__DEV__) console.log("GRAPHQL ROUTING =>", DEV_MODE ? "dev (local gateway)" : "prod");
  return authLink.concat(httpLink);
}

const link = buildRoutedLink();

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
  const k = String(v || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  if (k === "holo" || k === "holofoil" || k === "foil") return "holo";
  if (
    k === "reverse" ||
    k === "reverseholo" ||
    k === "reverseholofoil" ||
    k === "rev"
  )
    return "reverse";
  if (k === "normal" || k === "nonholo" || k === "nonfoil") return "normal";
  return k || "normal";
}

function canonCollectionVar(v) {
  const normalized = String(v || "normal")
    .trim()
    .toLowerCase();
  if (!normalized) return "normal";
  if (
    normalized === "reverse" ||
    normalized === "reverse holo" ||
    normalized === "reverse-holo"
  )
    return "reverse";
  if (
    normalized === "reverseholo" ||
    normalized === "reverseholofoil" ||
    normalized === "reversefoil"
  )
    return "reverse";
  if (
    normalized === "holofoil" ||
    normalized === "holo" ||
    normalized === "foil"
  )
    return "holo";
  return normalized;
}

export const client = new ApolloClient({
  link,
  cache: new InMemoryCache({
    typePolicies: {
      // Normalize cards by ID and smart-merge price arrays by variation + timestamp.
      Card: {
        keyFields: ["id"],
        fields: {
          prices: {
            keyArgs: false,
            merge(existing = [], incoming = []) {
              if (!incoming || incoming.length === 0) return existing ?? [];

              const byVariation = new Map();

              const push = (row) => {
                if (!row) return;
                const v = canonVar(row.variation);
                const norm = {
                  ...row,
                  variation: v,
                  tcgplayer: toNumberOrNull(row.tcgplayer ?? row.tcgPlayer),
                  cardmarket: toNumberOrNull(row.cardmarket ?? row.cardMarket),
                };

                const prev = byVariation.get(v);
                if (!prev) return void byVariation.set(v, norm);

                const newerFirst = ts(norm.updatedAt) - ts(prev.updatedAt);
                if (newerFirst > 0) {
                  byVariation.set(v, {
                    ...norm,
                    tcgplayer: norm.tcgplayer ?? prev.tcgplayer,
                    cardmarket: norm.cardmarket ?? prev.cardmarket,
                  });
                } else if (newerFirst < 0) {
                  byVariation.set(v, {
                    ...prev,
                    tcgplayer: prev.tcgplayer ?? norm.tcgplayer,
                    cardmarket: prev.cardmarket ?? norm.cardmarket,
                  });
                } else {
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

      // Your original composite key strategy for Collection items (keep as-is).
      Collection: {
        keyFields: (obj) => {
          if (!obj || typeof obj !== "object") return null;
          if (obj.id != null) return `collection:${obj.id}`;
          const cardId = obj.cardId ?? obj.card?.id ?? obj.card?.cardId;
          if (!cardId) return null;
          const variation = canonCollectionVar(
            obj.variation ?? obj.card?.variation ?? "normal",
          );
          return `collection:${cardId}:${variation}`;
        },
      },

      Query: {
        fields: {
          myCollection: {
            keyArgs: false,
            merge(existing = [], incoming = [], { readField }) {
              if (!incoming || incoming.length === 0) return existing || [];

              const map = new Map();

              const push = (ref) => {
                if (!ref) return;
                const id = readField("id", ref);
                const cardId = readField("cardId", ref);
                const variation = canonCollectionVar(
                  readField("variation", ref),
                );
                const key =
                  id != null
                    ? `id:${id}`
                    : cardId != null
                      ? `card:${cardId}:${variation}`
                      : `row:${map.size}`;
                map.set(key, ref);
              };

              (existing || []).forEach(push);
              (incoming || []).forEach(push);

              return Array.from(map.values());
            },
          },

          // Wrapper merge for wishlist page
          myWishlist: {
            keyArgs: false,
            merge(existing, incoming) {
              if (!existing) return incoming;
              if (!incoming) return existing;
              return { ...existing, ...incoming };
            },
          },
        },
      },

      // Search pagination policy must be top-level
      SearchCardsConnection: {
        fields: {
          edges: {
            keyArgs: false,
            merge(existing = [], incoming = []) {
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

      WishlistEntry: { keyFields: ["id"] },
      WishlistPage: {
        keyFields: false,
        fields: {
          entries: {
            keyArgs: false,
            merge(existing = [], incoming = [], { readField }) {
              const seen = new Set();
              const out = [];
              const push = (ref) => {
                if (!ref) return;
                const id = readField("id", ref);
                const key = id != null ? String(id) : JSON.stringify(ref);
                if (seen.has(key)) return;
                seen.add(key);
                out.push(ref);
              };
              (existing || []).forEach(push);
              (incoming || []).forEach(push);
              return out;
            },
          },
        },
      },
    },
  }),
});
