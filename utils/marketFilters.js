// utils/marketFilters.js

export function filterListings(listings, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return listings;
  return listings.filter(
    (x) =>
      (x.name || "").toLowerCase().includes(q) ||
      (x.setName || "").toLowerCase().includes(q) ||
      String(x.number || "").toLowerCase().includes(q) ||
      (x.seller || "").toLowerCase().includes(q)
  );
}
