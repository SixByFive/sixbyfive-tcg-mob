// app/lib/FeatureGate.js

export function FeatureGate({ enabled, children, fallback = null }) {
  if (!enabled) return fallback;
  return children;
}
