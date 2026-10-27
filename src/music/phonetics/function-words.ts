// Words that are normally unstressed in a sung or spoken line.

const ARTICLES = ["a", "an", "the"];

const PRONOUNS = [
  "i", "me", "my", "mine", "myself", "you", "your", "yours", "yourself", "yourselves", "ya", "y'all",
  "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves", "they", "them", "'em", "their", "theirs", "themselves",
  "who", "whom", "whose", "which", "that", "thee", "thou", "thy", "thine",
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd", "he's", "he'll", "he'd",
  "she's", "she'll", "she'd", "it's", "it'll", "it'd", "we're", "we've", "we'll", "we'd",
  "they're", "they've", "they'll", "they'd", "that's", "there's", "who's",
];

const AUXILIARIES = [
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
];

const PREPOSITIONS = [
  "about", "'bout", "above", "across", "after", "against", "along", "amid", "among", "around", "'round",
  "as", "at", "before", "behind", "below", "beneath", "beside", "besides", "between", "beyond", "by",
  "despite", "during", "except", "for", "from", "in", "into", "like", "near", "of", "o'", "on", "onto",
  "over", "o'er", "past", "per", "since", "than", "through", "thru", "throughout", "till", "'til", "til",
  "to", "toward", "towards", "under", "underneath", "unlike", "until", "upon", "via", "with", "within",
  "without",
];

const CONJUNCTIONS = [
  "and", "'n'", "n'", "an'", "or", "nor", "but", "so", "yet", "if", "because", "'cause", "cause", "cuz",
  "though", "although", "while", "whereas", "whether", "unless", "when", "where",
];

const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  ...ARTICLES,
  ...PRONOUNS,
  ...AUXILIARIES,
  ...PREPOSITIONS,
  ...CONJUNCTIONS,
]);

/** Articles, pronouns, auxiliaries, prepositions and conjunctions. */
export function isFunctionWord(word: string): boolean {
  return FUNCTION_WORDS.has(word.toLowerCase().replace(/[’‘]/g, "'"));
}
