// utils/priceSeries.js

export const TIMEFRAME_POINTS = {
  "7D": 14,  // denser look
  "30D": 30,
  "90D": 45,
  "1Y": 60,
};

export function makePlaceholderSeries(base, points) {
  const seed = Math.max(1, Math.floor((base || 10) * 13));
  const arr = [];
  let v = base || 10;

  for (let i = 0; i < points; i++) {
    const drift = (((i * 73 + seed) % 17) - 8) * 0.03; // ~[-0.24, 0.27]
    v = Math.max(0.1, v + drift);
    arr.push(Number(v.toFixed(2)));
  }
  return arr;
}

export function seriesStats(series) {
  if (!series || series.length === 0) return { min: null, max: null, avg: null };
  let min = series[0],
    max = series[0],
    sum = 0;
  for (const n of series) {
    if (n < min) min = n;
    if (n > max) max = n;
    sum += n;
  }
  const avg = sum / series.length;
  return { min, max, avg };
}

export function toBarHeights(series, maxPx = 80) {
  const maxVal = Math.max(1, Math.max(...series));
  return series.map((v) => Math.max(2, Math.round((v / maxVal) * maxPx)));
}
