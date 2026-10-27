// Word lists for deriving Standard Southern British pronunciations from General American ones.

/** Words with the BATH vowel /ɑː/ in Southern British English where General American has /æ/. */
export const BATH_WORDS: ReadonlySet<string> = new Set([
  "advance", "advantage", "after", "afternoon", "afterwards", "aghast", "alas", "answer", "ask", "aunt",
  "avalanche", "banana", "basket", "bath", "blast", "branch", "brass", "broadcast", "calf", "calves",
  "can't", "cast", "caste", "castle", "casket", "chance", "chancellor", "chant", "clasp", "class",
  "command", "commander", "contrast", "craft", "daft", "dance", "demand", "disaster", "draft", "draught",
  "enhance", "example", "fast", "fasten", "flask", "forecast", "france", "ghastly", "giraffe", "glance",
  "glass", "graft", "grant", "graph", "grasp", "grass", "half", "halves", "lance", "last", "laugh",
  "laughter", "mask", "mast", "master", "nasty", "outlast", "overcast", "pass", "past", "pastor",
  "path", "paths", "photograph", "plant", "plaster", "prance", "raft", "rascal", "rasp", "rather",
  "sample", "shaft", "shan't", "slander", "staff", "task", "telegraph", "trance", "vantage", "vast",
]);

/** Inflections that keep the BATH vowel of their base ("dancing", "passed", "glasses"). */
export const BATH_INFLECTIONS: readonly string[] = ["", "s", "es", "ed", "d", "ing", "er", "ers", "est", "ly", "'s", "y"];

/** First halves of compounds whose second half is a BATH word ("overpass", "hourglass"). */
export const BATH_COMPOUND_PREFIXES: readonly string[] = [
  "after", "auto", "back", "broad", "by", "down", "eye", "fore", "free", "hand", "head", "hour", "life",
  "mis", "out", "over", "para", "photo", "re", "sand", "sea", "sur", "tele", "un", "under", "up", "wild",
  "wine",
];

/**
 * Words spelled with "rr" after an r-final base keep the NURSE vowel /ɜː/ in British English
 * ("furry", "occurring"), unlike "hurry" or "worry" which have /ʌ/.
 */
export const NURSE_BEFORE_R_BASES: readonly string[] = [
  "aver", "blur", "concur", "confer", "defer", "demur", "deter", "fur", "incur", "infer", "inter",
  "occur", "prefer", "purr", "recur", "refer", "slur", "spur", "stir", "transfer", "whir",
];

/** British pronunciations that no rule derives from the American ones. */
export const UK_EXCEPTIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ["advertisement", ["ə d v ˈɜː t ɪ s m ə n t"]],
  ["again", ["ə g ˈɛ n", "ə g ˈeɪ n"]],
  ["aluminium", ["ˌæ l j ʊ m ˈɪ n i ə m"]],
  ["aluminum", ["ə l ˈuː m ɪ n ə m"]],
  ["ballet", ["b ˈæ l eɪ"]],
  ["basil", ["b ˈæ z ə l"]],
  ["because", ["b ɪ k ˈɒ z", "b ɪ k ˈɔː z"]],
  ["been", ["b ˈiː n"]],
  ["clerk", ["k l ˈɑː k"]],
  ["controversy", ["k ˈɒ n t ɹ ə v ˌɜː s i", "k ə n t ɹ ˈɒ v ə s i"]],
  ["derby", ["d ˈɑː b i"]],
  ["dynasty", ["d ˈɪ n ə s t i"]],
  ["either", ["ˈaɪ ð ə", "ˈiː ð ə"]],
  ["figure", ["f ˈɪ g ə"]],
  ["fillet", ["f ˈɪ l ɪ t"]],
  ["fragile", ["f ɹ ˈæ dʒ ˌaɪ l"]],
  ["garage", ["g ˈæ ɹ ɑː ʒ", "g ˈæ ɹ ɪ dʒ"]],
  ["herb", ["h ˈɜː b"]],
  ["laboratory", ["l ə b ˈɒ ɹ ə t ɹ i"]],
  ["leisure", ["l ˈɛ ʒ ə"]],
  ["lever", ["l ˈiː v ə"]],
  ["lieutenant", ["l ɛ f t ˈɛ n ə n t"]],
  ["mirror", ["m ˈɪ ɹ ə"]],
  ["missile", ["m ˈɪ s ˌaɪ l"]],
  ["mobile", ["m ˈəʊ b ˌaɪ l"]],
  ["neither", ["n ˈaɪ ð ə", "n ˈiː ð ə"]],
  ["niche", ["n ˈiː ʃ"]],
  ["oregano", ["ˌɒ ɹ ɪ g ˈɑː n əʊ"]],
  ["pasta", ["p ˈæ s t ə"]],
  ["patriot", ["p ˈæ t ɹ i ə t"]],
  ["privacy", ["p ɹ ˈɪ v ə s i", "p ɹ ˈaɪ v ə s i"]],
  ["process", ["p ɹ ˈəʊ s ɛ s"]],
  ["progress", ["p ɹ ˈəʊ g ɹ ɛ s"]],
  ["route", ["ɹ ˈuː t"]],
  ["schedule", ["ʃ ˈɛ dʒ uː l", "s k ˈɛ dʒ uː l"]],
  ["scone", ["s k ˈɒ n", "s k ˈəʊ n"]],
  ["shone", ["ʃ ˈɒ n"]],
  ["sorry", ["s ˈɒ ɹ i"]],
  ["squirrel", ["s k w ˈɪ ɹ ə l"]],
  ["tissue", ["t ˈɪ ʃ uː", "t ˈɪ s j uː"]],
  ["tomato", ["t ə m ˈɑː t əʊ"]],
  ["tomorrow", ["t ə m ˈɒ ɹ əʊ"]],
  ["vase", ["v ˈɑː z"]],
  ["vitamin", ["v ˈɪ t ə m ɪ n"]],
  ["yoghurt", ["j ˈɒ g ə t"]],
  ["yogurt", ["j ˈɒ g ə t"]],
  ["z", ["z ˈɛ d"]],
  ["zebra", ["z ˈɛ b ɹ ə"]],
]);
