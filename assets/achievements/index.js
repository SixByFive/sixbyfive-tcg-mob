// assets/achievements/index.js
// Local icons for achievements. Keys MUST match achievement.code from backend.

export const ACHIEVEMENT_ICONS = {
  // Backend code is "pre_signup"
  pre_signup: require("./day_1.png"),
};

// Optional fallback (generic badge if unmapped code comes through)
export const DEFAULT_ACHIEVEMENT_ICON = require("./_default_badge.png");
