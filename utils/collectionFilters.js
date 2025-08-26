// utils/collectionFilters.js

export function filterBinders(binders, q) {
  const query = (q || "").trim().toLowerCase();
  if (!query) return binders || [];
  return (binders || []).filter((b) => (b.name || "").toLowerCase().includes(query));
}
