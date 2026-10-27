// IPA phoneme inventory with articulatory features, shared by rhyme, prosody and singability.

/** Vowel height on the IPA vowel chart, from close (0) to open (1). */
const CLOSE = 0;
const NEAR_CLOSE = 1 / 6;
const CLOSE_MID = 1 / 3;
const MID = 1 / 2;
const OPEN_MID = 2 / 3;
const NEAR_OPEN = 5 / 6;
const OPEN = 1;

/** Vowel backness on the IPA vowel chart, from front (0) to back (1). */
const FRONT = 0;
const NEAR_FRONT = 1 / 4;
const CENTRAL = 1 / 2;
const NEAR_BACK = 3 / 4;
const BACK = 1;

export enum Place {
  Bilabial = "bilabial",
  Labiodental = "labiodental",
  Dental = "dental",
  Alveolar = "alveolar",
  Postalveolar = "postalveolar",
  Palatal = "palatal",
  Velar = "velar",
  Glottal = "glottal",
  LabialVelar = "labial-velar",
}

export enum Manner {
  Plosive = "plosive",
  Affricate = "affricate",
  Fricative = "fricative",
  Nasal = "nasal",
  Lateral = "lateral approximant",
  Approximant = "approximant",
}

export interface VowelQuality {
  height: number;
  backness: number;
  rounded: boolean;
}

export interface VowelFeatures extends VowelQuality {
  long: boolean;
  rhotic: boolean;
  /** Where a diphthong or triphthong moves to; null for a pure vowel. */
  glide: VowelQuality | null;
}

export interface ConsonantFeatures {
  place: Place;
  manner: Manner;
  voiced: boolean;
}

interface VowelOptions {
  long?: boolean;
  rhotic?: boolean;
  glide?: VowelQuality;
}

function quality(height: number, backness: number, rounded = false): VowelQuality {
  return { height, backness, rounded };
}

function vowel(height: number, backness: number, rounded: boolean, options: VowelOptions = {}): VowelFeatures {
  return {
    height,
    backness,
    rounded,
    long: options.long ?? false,
    rhotic: options.rhotic ?? false,
    glide: options.glide ?? null,
  };
}

function consonant(place: Place, manner: Manner, voiced: boolean): ConsonantFeatures {
  return { place, manner, voiced };
}

const TOWARDS_I = quality(NEAR_CLOSE, NEAR_FRONT);
const TOWARDS_U = quality(NEAR_CLOSE, NEAR_BACK, true);
const TOWARDS_SCHWA = quality(MID, CENTRAL);

const VOWELS = new Map<string, VowelFeatures>([
  ["i", vowel(CLOSE, FRONT, false, { long: true })],
  ["iː", vowel(CLOSE, FRONT, false, { long: true })],
  ["ɪ", vowel(NEAR_CLOSE, NEAR_FRONT, false)],
  ["eɪ", vowel(CLOSE_MID, FRONT, false, { long: true, glide: TOWARDS_I })],
  ["ɛ", vowel(OPEN_MID, FRONT, false)],
  ["æ", vowel(NEAR_OPEN, FRONT, false)],
  ["ɑ", vowel(OPEN, BACK, false, { long: true })],
  ["ɑː", vowel(OPEN, BACK, false, { long: true })],
  ["ɒ", vowel(OPEN, BACK, true)],
  ["ɔ", vowel(OPEN_MID, BACK, true, { long: true })],
  ["ɔː", vowel(OPEN_MID, BACK, true, { long: true })],
  ["oʊ", vowel(CLOSE_MID, BACK, true, { long: true, glide: TOWARDS_U })],
  ["əʊ", vowel(MID, CENTRAL, false, { long: true, glide: TOWARDS_U })],
  ["ʊ", vowel(NEAR_CLOSE, NEAR_BACK, true)],
  ["u", vowel(CLOSE, BACK, true, { long: true })],
  ["uː", vowel(CLOSE, BACK, true, { long: true })],
  ["ʌ", vowel(OPEN_MID, NEAR_BACK, false)],
  ["ə", vowel(MID, CENTRAL, false)],
  ["ɝ", vowel(MID, CENTRAL, false, { long: true, rhotic: true })],
  ["ɚ", vowel(MID, CENTRAL, false, { rhotic: true })],
  ["ɜː", vowel(MID, CENTRAL, false, { long: true })],
  ["aɪ", vowel(OPEN, FRONT, false, { long: true, glide: TOWARDS_I })],
  ["aʊ", vowel(OPEN, CENTRAL, false, { long: true, glide: TOWARDS_U })],
  ["ɔɪ", vowel(OPEN_MID, BACK, true, { long: true, glide: TOWARDS_I })],
  ["ɪə", vowel(NEAR_CLOSE, NEAR_FRONT, false, { long: true, glide: TOWARDS_SCHWA })],
  ["ɛə", vowel(OPEN_MID, FRONT, false, { long: true, glide: TOWARDS_SCHWA })],
  ["ʊə", vowel(NEAR_CLOSE, NEAR_BACK, true, { long: true, glide: TOWARDS_SCHWA })],
  ["aɪə", vowel(OPEN, FRONT, false, { long: true, glide: TOWARDS_SCHWA })],
  ["aʊə", vowel(OPEN, CENTRAL, false, { long: true, glide: TOWARDS_SCHWA })],
]);

const CONSONANTS = new Map<string, ConsonantFeatures>([
  ["p", consonant(Place.Bilabial, Manner.Plosive, false)],
  ["b", consonant(Place.Bilabial, Manner.Plosive, true)],
  ["t", consonant(Place.Alveolar, Manner.Plosive, false)],
  ["d", consonant(Place.Alveolar, Manner.Plosive, true)],
  ["k", consonant(Place.Velar, Manner.Plosive, false)],
  ["g", consonant(Place.Velar, Manner.Plosive, true)],
  ["f", consonant(Place.Labiodental, Manner.Fricative, false)],
  ["v", consonant(Place.Labiodental, Manner.Fricative, true)],
  ["θ", consonant(Place.Dental, Manner.Fricative, false)],
  ["ð", consonant(Place.Dental, Manner.Fricative, true)],
  ["s", consonant(Place.Alveolar, Manner.Fricative, false)],
  ["z", consonant(Place.Alveolar, Manner.Fricative, true)],
  ["ʃ", consonant(Place.Postalveolar, Manner.Fricative, false)],
  ["ʒ", consonant(Place.Postalveolar, Manner.Fricative, true)],
  ["h", consonant(Place.Glottal, Manner.Fricative, false)],
  ["tʃ", consonant(Place.Postalveolar, Manner.Affricate, false)],
  ["dʒ", consonant(Place.Postalveolar, Manner.Affricate, true)],
  ["m", consonant(Place.Bilabial, Manner.Nasal, true)],
  ["n", consonant(Place.Alveolar, Manner.Nasal, true)],
  ["ŋ", consonant(Place.Velar, Manner.Nasal, true)],
  ["l", consonant(Place.Alveolar, Manner.Lateral, true)],
  ["ɹ", consonant(Place.Alveolar, Manner.Approximant, true)],
  ["w", consonant(Place.LabialVelar, Manner.Approximant, true)],
  ["j", consonant(Place.Palatal, Manner.Approximant, true)],
]);

/** Weak vowels that stand in for each other in unstressed syllables. */
const REDUCED_VOWELS = new Set(["ə", "ɪ", "ʊ", "i", "ɚ"]);

/** Vowels whose quality stays open enough to sustain comfortably (open-mid and lower at the start). */
const OPEN_VOWEL_HEIGHT = OPEN_MID;
/** Vowels at or above near-close height are closed for singing purposes. */
const CLOSED_VOWEL_HEIGHT = NEAR_CLOSE;

export function isVowel(phoneme: string): boolean {
  return VOWELS.has(phoneme);
}

export function isConsonant(phoneme: string): boolean {
  return CONSONANTS.has(phoneme);
}

export function vowelFeatures(phoneme: string): VowelFeatures | undefined {
  return VOWELS.get(phoneme);
}

export function consonantFeatures(phoneme: string): ConsonantFeatures | undefined {
  return CONSONANTS.get(phoneme);
}

export function isReducedVowel(phoneme: string): boolean {
  return REDUCED_VOWELS.has(phoneme);
}

/** Open vowels (as in "ah", "aw", "eye") are the easiest to hold on long or high notes. */
export function isOpenVowel(phoneme: string): boolean {
  const features = VOWELS.get(phoneme);
  return features !== undefined && !features.rhotic && features.height >= OPEN_VOWEL_HEIGHT;
}

/** Closed vowels (as in "ee", "oo") and r-coloured vowels are hard to sustain high up. */
export function isClosedVowel(phoneme: string): boolean {
  const features = VOWELS.get(phoneme);
  return features !== undefined && (features.rhotic || features.height <= CLOSED_VOWEL_HEIGHT);
}

export function isVoiceless(phoneme: string): boolean {
  return CONSONANTS.get(phoneme)?.voiced === false;
}
