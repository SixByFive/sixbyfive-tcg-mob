// utils/marketDemoData.js

export function makeDemoListings(n = 10) {
  return Array.from({ length: n }).map((_, i) => ({
    id: `L${i + 1}`,
    name: ["Pikachu", "Charizard", "Gengar", "Mewtwo"][i % 4],
    setName: ["Twilight Masquerade", "Obsidian Flames"][i % 2],
    number: ["201/213", "125/197", "238/218"][i % 3],
    image: "https://assets.tcgdex.net/en/sv/sv08/238/high.webp",
    price: (5 + Math.random() * 45).toFixed(2),
    condition: ["NM", "LP", "MP"][i % 3],
    seller: ["cardking", "binderBee", "pokeJoe"][i % 3],
  }));
}

export const demoTrades = {
  incoming: [
    { id: "T1", from: "binderBee", want: "Charizard 125/197", give: "Pikachu 201/213", status: "pending" },
  ],
  outgoing: [
    { id: "T2", to: "pokeJoe", want: "Gengar 238/218", give: "Mewtwo 167/198", status: "countered" },
  ],
};
