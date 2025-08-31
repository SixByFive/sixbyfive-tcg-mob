// lib/fakeUsers.js

const avatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2963FF&color=fff`;

export const FAKE_USERS = [
  {
    id: "u1",
    username: "ryan",
    displayName: "Ryan",
    avatarUrl: avatar("Ryan"),
    bio: "Collector of rare pulls. Building out my Lugia set.",
    favouritePokemon: "Lugia",
    recentBinders: [
      { id: "b1", title: "Kanto Starters" },
      { id: "b2", title: "Legendaries" },
      { id: "b3", title: "EX/V Showcase" },
    ],
    wishlistPreview: [
      { id: "w1", name: "Lugia V", setName: "Silver Tempest", number: "186/195", image: "https://placehold.co/300x420/png?text=Lugia+V", prices: [{ currency: "USD", value: 24.99 }] },
      { id: "w2", name: "Charizard ex", setName: "Obsidian Flames", number: "125/197", image: "https://placehold.co/300x420/png?text=Charizard+ex", prices: [{ currency: "USD", value: 39.95 }] },
    ],
  },
  {
    id: "u2",
    username: "lugia_lover",
    displayName: "Lugia Lover",
    avatarUrl: avatar("Lugia Lover"),
    bio: "Everything Lugia, all the time.",
    favouritePokemon: "Lugia",
    recentBinders: [{ id: "b4", title: "Lugia Gallery" }],
    wishlistPreview: [
      { id: "w3", name: "Lugia GX", setName: "Lost Thunder", number: "SM8", image: "https://placehold.co/300x420/png?text=Lugia+GX", prices: [{ currency: "USD", value: 18.0 }] },
    ],
  },
  {
    id: "u3",
    username: "charizardfan",
    displayName: "Charizard Fan",
    avatarUrl: avatar("Charizard Fan"),
    bio: "Hunting Charizards since day one.",
    favouritePokemon: "Charizard",
    recentBinders: [{ id: "b5", title: "Charizard Line" }],
    wishlistPreview: [
      { id: "w4", name: "Charizard VSTAR", setName: "Brilliant Stars", number: "018/172", image: "https://placehold.co/300x420/png?text=Charizard+VSTAR", prices: [{ currency: "USD", value: 28.5 }] },
    ],
  },
];

// Simulated latency (to mimic a real network)
const FAKE_DELAY_MS = 250;

export function searchUsersLocal(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return Promise.resolve([]);
  const res = FAKE_USERS.filter(
    (u) =>
      u.username.toLowerCase().includes(q) ||
      (u.displayName || "").toLowerCase().includes(q)
  ).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    isFollowing: false, // UI-only
  }));
  return new Promise((resolve) => setTimeout(() => resolve(res), FAKE_DELAY_MS));
}

export function getUserByUsernameLocal(username) {
  const u = FAKE_USERS.find(
    (x) => x.username.toLowerCase() === String(username || "").toLowerCase()
  );
  return u || null;
}
