// utils/cards.js

export function normalizeImageUrl(url) {
  if (!url) return null;
  return url.endsWith("/high.webp") ? url : `${url}/high.webp`;
}

export function getBestPrice(prices, prefer = "normal") {
  if (!Array.isArray(prices))
    return { tcgplayer: null, cardmarket: null, variation: null };

  const preferred = prices.find((p) => p.variation === prefer);
  if (preferred) return preferred;

  const any = prices.find(
    (p) =>
      (typeof p.tcgplayer === "number" && !isNaN(p.tcgplayer)) ||
      (typeof p.cardmarket === "number" && !isNaN(p.cardmarket))
  );
  return any || { tcgplayer: null, cardmarket: null, variation: null };
}

export function calcAverage(a, b) {
  const aOk = typeof a === "number" && !isNaN(a);
  const bOk = typeof b === "number" && !isNaN(b);
  if (aOk && bOk) return (a + b) / 2;
  if (aOk) return a;
  if (bOk) return b;
  return null;
}

