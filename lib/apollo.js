// app/lib/apollo.js
import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import Constants from "expo-constants";
import { getToken } from "./auth";

/**
 * Helper: normalize date timestamps so we can compare "newest wins"
 * - Supports ISO strings and "YYYY/MM/DD" or "YYYY-MM-DD"
 */
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

// Stable UI ordering for price variations
const PRICE_VARIATION_ORDER = ["holo", "normal", "reverse"];

const uri =
  process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT ??
  Constants.expoConfig?.extra?.EXPO_PUBLIC_GRAPHQL_ENDPOINT;

console.log("GRAPHQL ENDPOINT =>", uri);

const httpLink = createHttpLink({ uri });

const authLink = setContext(async (_, { headers }) => {
  const token = await getToken();
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

/**
 * Cache policies
 * - CardPriceVariation: identify rows by `variation`
 * - Card.prices: custom merge to dedupe by variation and prefer newest updatedAt
 *
 * This prevents the "Cache data may be lost when replacing the prices field of a Card" warning
 * and avoids extra network requests due to array replacement.
 */
const cache = new InMemoryCache({
  typePolicies: {
    // If your schema uses a different typename (e.g. "PokemonCardPrice"),
    // change "CardPriceVariation" and "Card" below accordingly.
    CardPriceVariation: {
      keyFields: ["variation"],
    },
    Card: {
      fields: {
        prices: {
          keyArgs: false, // always merge, not per-args
          merge(existing = [], incoming = [], { readField }) {
            const byVar = new Map();

            const put = (arr) => {
              for (const row of arr) {
                if (!row) continue;

                // variation can be read via readField for normalized refs or raw for embedded
                const v = String(
                  (readField?.("variation", row) ?? row.variation ?? "normal")
                )
                  .toLowerCase()
                  .replace(/[\s_-]/g, "");

                const prev = byVar.get(v);
                if (!prev) {
                  byVar.set(v, row);
                  continue;
                }

                // Prefer the newer updatedAt; otherwise overlay non-nullish fields from incoming
                const prevTs = ts(readField?.("updatedAt", prev) ?? prev.updatedAt);
                const nextTs = ts(readField?.("updatedAt", row) ?? row.updatedAt);

                if (nextTs >= prevTs) {
                  byVar.set(v, { ...prev, ...row });
                } else {
                  byVar.set(v, { ...row, ...prev });
                }
              }
            };

            put(existing);
            put(incoming);

            // Return stable order for UI
            const ordered = Array.from(byVar.entries()).sort(([a], [b]) => {
              const ai = PRICE_VARIATION_ORDER.indexOf(a);
              const bi = PRICE_VARIATION_ORDER.indexOf(b);
              if (ai !== -1 && bi !== -1) return ai - bi;
              if (ai !== -1) return -1;
              if (bi !== -1) return 1;
              return a.localeCompare(b);
            });

            return ordered.map(([, val]) => val);
          },
        },
      },
    },
  },
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache,
});
