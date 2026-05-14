const ADJECTIVES = [
  "Stellar",
  "Astral",
  "Quantum",
  "Nebular",
  "Lunar",
  "Solar",
  "Plasma",
  "Cosmic",
  "Galactic",
  "Orbital",
  "Warp",
  "Hyper",
  "Cyber",
  "Neural",
  "Holographic",
  "Ion",
  "Photon",
  "Chrome",
  "Crystalline",
  "Void",
  "Eclipse",
  "Tachyon",
  "Antimatter",
  "Pulsar",
  "Vortex",
  "Subspace",
  "Phantom",
  "Spectral",
  "Onyx",
  "Sable",
];

const NOUNS = [
  "Voyager",
  "Sentinel",
  "Nomad",
  "Wraith",
  "Specter",
  "Drifter",
  "Pilgrim",
  "Wanderer",
  "Outrider",
  "Marauder",
  "Reaver",
  "Cipher",
  "Architect",
  "Mainframe",
  "Daemon",
  "Synth",
  "Mecha",
  "Quasar",
  "Nova",
  "Beacon",
  "Cruiser",
  "Frigate",
  "Corvette",
  "Probe",
  "Scout",
  "Helix",
  "Vector",
  "Pioneer",
  "Oracle",
  "Monolith",
];

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function wackyName(repoFullName: string) {
  const hash = fnv1a(repoFullName);
  const adj = ADJECTIVES[hash % ADJECTIVES.length];
  const noun = NOUNS[(hash >>> 5) % NOUNS.length];
  const suffix = (hash >>> 10).toString(36).padStart(3, "0").slice(-3);
  return `${adj} ${noun} ${suffix}`;
}
