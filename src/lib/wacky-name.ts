const ADJECTIVES = [
  "Mysterious",
  "Secret",
  "Ancient",
  "Cosmic",
  "Phantom",
  "Sneaky",
  "Rogue",
  "Cryptic",
  "Velvet",
  "Midnight",
];

const NOUNS = [
  "Penguin",
  "Capybara",
  "Narwhal",
  "Axolotl",
  "Quokka",
  "Pangolin",
  "Tapir",
  "Numbat",
  "Platypus",
  "Wombat",
];

export function wackyName(repoFullName: string) {
  let hash = 0;
  for (const char of repoFullName) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return `${ADJECTIVES[hash % ADJECTIVES.length]} ${
    NOUNS[(hash >>> 4) % NOUNS.length]
  }`;
}
