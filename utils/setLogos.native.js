// utils/setLogos.native.js
// Mobile resolver that fetches the SAME set-logo files your web uses.
// Priority: Next.js Optimizer URL → Direct assets URL → default origin → null (let UI render fallback)
//
// Env (choose one; but we will fall back to DEFAULT_ORIGIN if neither is set):
//   EXPO_PUBLIC_SET_LOGO_OPTIMIZER_URL=https://tcg.sixbyfive.com/_next/image
//   EXPO_PUBLIC_SET_LOGO_OPT_W=192
//   EXPO_PUBLIC_SET_LOGO_OPT_Q=90
// or
//   EXPO_PUBLIC_SET_LOGO_BASE_URL=https://tcg.sixbyfive.com/assets/set-logos
// or
//   EXPO_PUBLIC_SITE_ORIGIN=https://tcg.sixbyfive.com   // derives both
//
// Signature: getSetLogo(name, codeOrId, logoPathFromApi?)
// - Returns { uri } or null

/* ---------------- Web mappings (ported) ---------------- */

const SET_LOGOS = {
  // Mainline Sets
  "Base Set": "base-set-logo.png",
  Jungle: "jungle-logo.png",
  Fossil: "fossil-logo.png",
  "Base Set 2": "base-set-2-logo.png",
  "Team Rocket": "team-rocket-logo.png",
  "Gym Heroes": "gym-heroes-logo.png",
  "Gym Challenge": "gym-challenge-logo.png",
  "Neo Genesis": "neo-genesis-logo.png",
  "Neo Discovery": "neo-discovery-logo.png",
  "Neo Revelation": "neo-revelation-logo.png",
  "Neo Destiny": "neo-destiny-logo.png",
  "Legendary Collection": "legendary-collection-logo.png",
  "Expedition Base Set": "expedition-base-set-logo.png",
  Aquapolis: "aquapolis-logo.png",
  Skyridge: "skyridge-logo.png",
  "Ruby & Sapphire": "ruby-sapphire-logo.png",
  Sandstorm: "sandstorm-logo.png",
  Dragon: "dragon-logo.png",
  "Team Magma vs Team Aqua": "magma-aqua-logo.png",
  "Hidden Legends": "hidden-legends-logo.png",
  "FireRed & LeafGreen": "firered-leafgreen-logo.png",
  "Team Rocket Returns": "team-rocket-returns-logo.png",
  Deoxys: "deoxys-logo.png",
  Emerald: "emerald-logo.png",
  "Unseen Forces": "unseen-forces-logo.png",
  "Delta Species": "delta-species-logo.png",
  "Legend Maker": "legend-maker-logo.png",
  "Holon Phantoms": "holon-phantoms-logo.png",
  "Crystal Guardians": "crystal-guardians-logo.png",
  "Dragon Frontiers": "dragon-frontiers-logo.png",
  "Power Keepers": "power-keepers-logo.png",
  "Diamond & Pearl": "diamond-pearl-logo.png",
  "Mysterious Treasures": "mysterious-treasures-logo.png",
  "Secret Wonders": "secret-wonders-logo.png",
  "Great Encounters": "great-encounters-logo.png",
  "Majestic Dawn": "majestic-dawn-logo.png",
  "Legends Awakened": "legends-awakened-logo.png",
  Stormfront: "stormfront-logo.png",
  Platinum: "platinum-logo.png",
  "Rising Rivals": "rising-rivals-logo.png",
  "Supreme Victors": "supreme-victors-logo.png",
  Arceus: "arceus-logo.png",
  "HeartGold & SoulSilver": "heartgold-soulsilver-logo.png",
  Unleashed: "unleashed-logo.png",
  Undaunted: "undaunted-logo.png",
  Triumphant: "triumphant-logo.png",
  "Call of Legends": "call-of-legends-logo.png",
  "Black & White": "black-white-logo.png",
  "Emerging Powers": "emerging-powers-logo.png",
  "Noble Victories": "noble-victories-logo.png",
  "Next Destinies": "next-destinies-logo.png",
  "Dark Explorers": "dark-explorers-logo.png",
  "Dragons Exalted": "dragons-exalted-logo.png",
  "Boundaries Crossed": "boundaries-crossed-logo.png",
  "Plasma Storm": "plasma-storm-logo.png",
  "Plasma Freeze": "plasma-freeze-logo.png",
  "Plasma Blast": "plasma-blast-logo.png",
  "Legendary Treasures": "legendary-treasures-logo.png",
  "Kalos Starter": "kalos-starter-logo.png",
  XY: "xy-logo.png",
  Flashfire: "flashfire-logo.png",
  "Furious Fists": "furious-fists-logo.png",
  "Phantom Forces": "phantom-forces-logo.png",
  "Primal Clash": "primal-clash-logo.png",
  "Double Crisis": "double-crisis-logo.png",
  "Roaring Skies": "roaring-skies-logo.png",
  "Ancient Origins": "ancient-origins-logo.png",
  BREAKthrough: "breakthrough-logo.png",
  BREAKpoint: "breakpoint-logo.png",
  "Fates Collide": "fates-collide-logo.png",
  "Steam Siege": "steam-siege-logo.png",
  Evolutions: "evolutions-logo.png",
  "Sun & Moon": "sun-moon-logo.png",
  "Guardians Rising": "guardians-rising-logo.png",
  "Burning Shadows": "burning-shadows-logo.png",
  "Shining Legends": "shining-legends-logo.png",
  "Crimson Invasion": "crimson-invasion-logo.png",
  "Ultra Prism": "ultra-prism-logo.png",
  "Forbidden Light": "forbidden-light-logo.png",
  "Celestial Storm": "celestial-storm-logo.png",
  "Dragon Majesty": "dragon-majesty-logo.png",
  "Lost Thunder": "lost-thunder-logo.png",
  "Team Up": "team-up-logo.png",
  "Unbroken Bonds": "unbroken-bonds-logo.png",
  "Unified Minds": "unified-minds-logo.png",
  "Hidden Fates": "hidden-fates-logo.png",
  "Cosmic Eclipse": "cosmic-eclipse-logo.png",
  "Sword & Shield": "sword-shield-logo.png",
  "Rebel Clash": "rebel-clash-logo.png",
  "Darkness Ablaze": "darkness-ablaze-logo.png",
  "Champion's Path": "champions-path-logo.webp", // edited
  "Vivid Voltage": "vivid-voltage-logo.png",
  "Shining Fates": "shining-fates-logo.png",
  "Battle Styles": "battle-styles-logo.png",
  "Chilling Reign": "chilling-reign-logo.png",
  "Evolving Skies": "evolving-skies-logo.png",
  "Fusion Strike": "fusion-strike-logo.png",
  "Brilliant Stars": "brilliant-stars-logo.png",
  "Astral Radiance": "astral-radiance-logo.png",
  "Pokémon GO": "pokemon-go-logo.png",
  "Lost Origin": "lost-origin-logo.png",
  "Silver Tempest": "silver-tempest-logo.png",
  "Crown Zenith": "crown-zenith-logo.png",
  "Scarlet & Violet": "scarlet-violet-base-logo.png",
  "Paldea Evolved": "paldea-evolved-logo.png",
  "Obsidian Flames": "obsidian-flames-logo.png",
  151: "151-logo.png",
  "Paradox Rift": "paradox-rift-logo.png",
  "Paldean Fates": "paldean-fates-logo.png",
  "Temporal Forces": "temporal-forces-logo.png",
  "Twilight Masquerade": "twilight-masquerade-logo.png",
  "Shrouded Fable": "shrouded-fable-logo.png",
  "Stellar Crown": "stellar-crown-logo.png",
  "Surging Sparks": "surging-sparks-logo.png",
  "Prismatic Evolutions": "prismatic-evolutions-logo.png",
  "Journey Together": "journey-together-logo.png",
  "Destined Rivals": "destined-rivals-logo.png",
  "Black Bolt": "black-bolt-logo.png",
  "White Flare": "white-flare-logo.png",
  "Mega Evolution": "mega-evolutions-base-logo.png",

  // Trainer Kits, Vaults, Classic, Special, etc.
  "Detective Pikachu": "detective-pikachu-logo.png",
  Celebrations: "celebrations-logo.png",
  "Celebrations: Classic Collection":
    "celebrations-classic-collection-logo.png",
  "Crown Zenith Galarian Gallery": "crown-zenith-galarian-gallery-logo.png",
  "Brilliant Stars Trainer Gallery": "brilliant-stars-trainer-gallery-logo.png",
  "Astral Radiance Trainer Gallery": "astral-radiance-trainer-gallery-logo.png",
  "Lost Origin Trainer Gallery": "lost-origin-trainer-gallery-logo.png",
  "Silver Tempest Trainer Gallery": "silver-tempest-trainer-gallery-logo.png",
  "Shining Fates Shiny Vault": "shining-fates-logo.png",
  "Hidden Fates Shiny Vault": "hidden-fates-logo.png",

  // Promo, POP, McDonald's, Rumble, etc.
  "Wizards Black Star Promos": "promo-logo.webp",
  "Nintendo Black Star Promos": "promo-logo.webp",
  "DP Black Star Promos": "promo-logo.webp",
  "HGSS Black Star Promos": "promo-logo.webp",
  "BW Black Star Promos": "promo-logo.webp",
  "XY Black Star Promos": "promo-logo.webp",
  "SM Black Star Promos": "promo-logo.webp",
  "Sword & Shield Black Star Promos": "promo-logo.webp",
  "Scarlet & Violet Black Star Promos": "promo-logo.webp",
  "Mega Evolution Black Star Promos": "promo-logo.webp",
  "POP Series 1": "pop-series-1-logo.png",
  "POP Series 2": "pop-series-2-logo.png",
  "POP Series 3": "pop-series-3-logo.png",
  "POP Series 4": "pop-series-4-logo.png",
  "POP Series 5": "pop-series-5-logo.png",
  "POP Series 6": "pop-series-6-logo.png",
  "POP Series 7": "pop-series-7-logo.png",
  "POP Series 8": "pop-series-8-logo.png",
  "POP Series 9": "pop-series-9-logo.png",
  "Best of Game": "best-of-game-logo.png",
  "Southern Islands": "southern-islands-logo.png",
  "Pokémon Rumble": "pokemon-rumble-logo.png",
  "Pokémon Futsal Collection": "pokemon-tcg-logo.png",
  "Scarlet & Violet Energy": "scarlet-violet-energy-logo.png",

  // McDonald's sets (by year)
  "McDonald's Collection 2011": "mcdonalds-collection-2011-logo.png",
  "McDonald's Collection 2012": "mcdonalds-collection-2012-logo.png",
  "McDonald's Collection 2014": "mcdonalds-collection-2014-logo.png",
  "McDonald's Collection 2015": "mcdonalds-collection-2015-logo.png",
  "McDonald's Collection 2016": "mcdonalds-collection-2016-logo.png",
  "McDonald's Collection 2017": "mcdonalds-collection-2017-logo.png",
  "McDonald's Collection 2018": "mcdonalds-collection-2018-logo.png",
  "McDonald's Collection 2019": "mcdonalds-collection-2019-logo.png",
  "McDonald's Collection 2021": "mcdonalds-collection-2021-logo.png",
  "McDonald's Collection 2022": "mcdonalds-collection-2022-logo.png",
  "McDonald's Match Battle 2023": "mcdonalds-match-battle-2023-logo.png",
};

const DEFAULT_SET_LOGO = "pokemon-tcg-logo.png";

// If no env is present, we’ll fall back to this site origin.
// You can change this to staging if needed.
const DEFAULT_ORIGIN = "https://tcg.sixbyfive.com";

// Synonyms / normalization for common variants
const NAME_SYNONYMS = {
  "pokemon go": "Pokémon GO",
  "champion's path": "Champion's Path",

  // Promo shorthand → canonical
  "svp black star promos": "Scarlet & Violet Black Star Promos",
  "swsh black star promos": "Sword & Shield Black Star Promos",
  "sm black star promos": "SM Black Star Promos",
  "xy black star promos": "XY Black Star Promos",
  "bw black star promos": "BW Black Star Promos",
  "hgss black star promos": "HGSS Black Star Promos",
  "dp black star promos": "DP Black Star Promos",
  "mep black star promos": "Mega Evolution Black Star Promos",
};

/* ---------------- Helpers ---------------- */

function normalizeNameKey(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[—–]/g, "-") // dashes
    .replace(/&/g, "-") // match web filenames (e.g., scarlet-violet)
    .replace(/[:]/g, " ")
    .replace(/[^\w\s-]/g, "") // punctuation
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findCanonicalName(setName) {
  if (!setName) return null;

  // exact case-insensitive
  const exact = Object.keys(SET_LOGOS).find(
    (k) => k.toLowerCase() === String(setName).trim().toLowerCase(),
  );
  if (exact) return exact;

  // normalized/synonym
  const norm = normalizeNameKey(setName);
  const syn = NAME_SYNONYMS[norm];
  if (syn && SET_LOGOS[syn]) return syn;

  // normalized direct match
  for (const key of Object.keys(SET_LOGOS)) {
    if (normalizeNameKey(key) === norm) return key;
  }
  return null;
}

function codePrefixFromId(idOrCode) {
  if (!idOrCode) return null;
  const s = String(idOrCode).toLowerCase();
  const dash = s.indexOf("-");
  return dash > 0 ? s.slice(0, dash) : s; // 'sv08-057' → 'sv08'
}

function filenameFromPath(path) {
  if (!path) return null;
  const tail = String(path).split("/").filter(Boolean).pop();
  return tail || null;
}

function slugifyToLogoFilename(nameOrCode) {
  const base = String(nameOrCode || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[—–]/g, "-")
    .replace(/&/g, "-") // keep aligned with normalizeNameKey
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return base ? `${base}-logo.png` : null;
}

function buildDirectUrl(base, filename) {
  const safe = String(base || "").replace(/\/+$/, "");
  return `${safe}/${filename}`;
}

function buildOptimizerUrl(optimizerBase, filename, w, q) {
  const opt = String(optimizerBase || "").replace(/\/+$/, "");
  const inner = `/assets/set-logos/${filename}`;
  const urlParam = encodeURIComponent(inner);
  const width = Number.isFinite(+w) && +w > 0 ? +w : 256;
  const quality = Number.isFinite(+q) && +q >= 1 && +q <= 100 ? +q : 90;
  return `${opt}?url=${urlParam}&w=${width}&q=${quality}`;
}

function deriveFromSiteOrigin() {
  const originFromEnv = process.env.EXPO_PUBLIC_SITE_ORIGIN;
  const ORIGIN =
    (originFromEnv && originFromEnv.replace(/\/+$/, "")) || DEFAULT_ORIGIN;
  return {
    BASE: `${ORIGIN}/assets/set-logos`,
    OPT: `${ORIGIN}/_next/image`,
  };
}

/* ---------------- Public API ---------------- */

/**
 * Resolve a remote image source for a set logo that your native app can load.
 *
 * @param {string} setName                 e.g., "Obsidian Flames"
 * @param {string} setCodeOrId             e.g., "sv03" or "sv03-120"
 * @param {string} [logoPathFromApi]       OPTIONAL: "/assets/set-logos/obsidian-flames-logo.png"
 * @returns {{uri: string} | null}
 */
export function getSetLogo(setName, setCodeOrId, logoPathFromApi) {
  // 0) Backend-provided path wins
  const fromApiFile = filenameFromPath(logoPathFromApi);

  // 1) Name → canonical file (web map)
  const canonicalFromName = findCanonicalName(setName);
  const fileFromName = canonicalFromName ? SET_LOGOS[canonicalFromName] : null;

  // 2) Fallback: slug from name
  const fileFromNameSlug = !fileFromName
    ? slugifyToLogoFilename(setName)
    : null;

  // 3) Last resort: slug from code/id
  const codeKey = codePrefixFromId(setCodeOrId);
  const fileFromCodeSlug =
    !fileFromName && !fileFromNameSlug ? slugifyToLogoFilename(codeKey) : null;

  // Choose filename
  const filename =
    fromApiFile ||
    fileFromName ||
    fileFromNameSlug ||
    fileFromCodeSlug ||
    DEFAULT_SET_LOGO;

  // If already a full URL, pass-through
  if (/^https?:\/\//i.test(filename)) {
    return { uri: filename };
  }

  // Resolve URL strategy: env → derived from ORIGIN → defaults
  const derived = deriveFromSiteOrigin();
  const OPT = process.env.EXPO_PUBLIC_SET_LOGO_OPTIMIZER_URL || derived.OPT;
  const OPT_W = process.env.EXPO_PUBLIC_SET_LOGO_OPT_W;
  const OPT_Q = process.env.EXPO_PUBLIC_SET_LOGO_OPT_Q;
  const BASE = process.env.EXPO_PUBLIC_SET_LOGO_BASE_URL || derived.BASE;

  // Prefer optimizer (matches your example URLs)
  if (OPT) return { uri: buildOptimizerUrl(OPT, filename, OPT_W, OPT_Q) };
  if (BASE) return { uri: buildDirectUrl(BASE, filename) };

  // Shouldn't reach here because we derive defaults, but just in case:
  return null;
}

export default getSetLogo;
