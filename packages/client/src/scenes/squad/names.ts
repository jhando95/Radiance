/**
 * Seeded callsign generator for mercenaries: grim frontier / sci-fi names built from
 * syllables plus a few hand-picked surnames and nicknames ("Vesk Marrow",
 * "Ilo 'Cinder' Tamm", "Brask"). Same seed -> same name.
 */

export const MAX_NAME_LENGTH = 24;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ONSETS = [
  "V",
  "K",
  "Br",
  "Il",
  "T",
  "M",
  "S",
  "D",
  "R",
  "Z",
  "N",
  "Cal",
  "Or",
  "Ash",
  "Gr",
  "Th",
  "Kh",
  "J",
  "Hal",
  "Sk",
  "Var",
  "Dr",
  "Ul",
  "Ys",
  "Cor",
  "P",
  "Wr",
  "Esk",
];
const VOWELS = ["e", "a", "o", "i", "u", "y", "ae", "ei", "ou", "a", "e", "o"];
const CODAS = [
  "sk",
  "n",
  "r",
  "x",
  "th",
  "l",
  "m",
  "ck",
  "ss",
  "v",
  "nd",
  "rk",
  "",
  "",
  "",
  "sh",
  "t",
  "z",
];
const SURNAMES = [
  "Marrow",
  "Tamm",
  "Vane",
  "Holloway",
  "Kest",
  "Rook",
  "Ashby",
  "Crane",
  "Dross",
  "Slate",
  "Grieve",
  "Coil",
  "Harrow",
  "Voss",
  "Mercer",
  "Kade",
  "Thorne",
  "Quill",
  "Blackwell",
  "Sorrow",
  "Hask",
  "Orrin",
  "Pike",
  "Wren",
  "Corvid",
  "Lusk",
  "Fenn",
  "Duskway",
  "Tallow",
  "Grist",
];
const NICKNAMES = [
  "Cinder",
  "Wick",
  "Ghost",
  "Dusk",
  "Ratchet",
  "Ember",
  "Lamp",
  "Shiv",
  "Hollow",
  "Tallow",
  "Static",
  "Grit",
  "Ash",
  "Flint",
  "Soot",
  "Rust",
  "Ion",
  "Murk",
  "Sparks",
  "Vigil",
  "Lucky",
  "Gravel",
  "Hex",
  "Candle",
  "Coldiron",
  "Nine",
];

function pickFrom<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)] as T;
}

function syllableName(r: () => number, syllables: number): string {
  let out = "";
  for (let i = 0; i < syllables; i++) {
    const onset = pickFrom(r, ONSETS);
    out += i === 0 ? onset : onset.toLowerCase();
    out += pickFrom(r, VOWELS);
    if (i === syllables - 1 || r() < 0.12) out += pickFrom(r, CODAS);
  }
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** A random callsign (≤ 24 chars). */
export function randomName(seed: number): string {
  const r = rng(seed);
  let first = syllableName(r, r() < 0.65 ? 1 : 2);
  if (first.length < 4) first += pickFrom(r, ["ek", "an", "is", "or", "ra", "ix"]);
  const last = r() < 0.75 ? pickFrom(r, SURNAMES) : syllableName(r, 2);
  const roll = r();
  let name: string;
  if (roll < 0.18) name = syllableName(r, 2);
  else if (roll < 0.4) name = `${first} '${pickFrom(r, NICKNAMES)}' ${last}`;
  else if (roll < 0.48) name = `'${pickFrom(r, NICKNAMES)}' ${last}`;
  else name = `${first} ${last}`;
  return name.length <= MAX_NAME_LENGTH ? name : `${first} ${last}`.slice(0, MAX_NAME_LENGTH);
}
