// utils/pokemonSprite.js
//
// Resolve a Pokémon sprite URL from a card name (e.g. "Dark Charizard ex",
// "Mr. Mime V"). Used by the no-image card fallback.
// Source list mirrors tcg-fullstack/frontend/src/data/pokemonList.json (name -> pokemondb slug).

import SPRITES from "../assets/data/pokemonSprites.json";

const SPRITE_BASE = "https://img.pokemondb.net/sprites/home/normal/";
const MAX_WORDS = 3; // longest species name: "Type: Null", "Tapu Koko", "Great Tusk"

function words(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

let SLUG_BY_KEY = null;
function slugByKey() {
  if (!SLUG_BY_KEY) {
    SLUG_BY_KEY = new Map();
    for (const [name, slug] of Object.entries(SPRITES)) {
      SLUG_BY_KEY.set(words(name).join(" "), slug);
    }
  }
  return SLUG_BY_KEY;
}

export function getPokemonSpriteUrl(cardName) {
  const w = words(cardName);
  if (!w.length) return null;
  const map = slugByKey();
  for (let size = Math.min(MAX_WORDS, w.length); size >= 1; size--) {
    for (let i = 0; i + size <= w.length; i++) {
      const slug = map.get(w.slice(i, i + size).join(" "));
      if (slug) return `${SPRITE_BASE}${slug}.png`;
    }
  }
  return null;
}
