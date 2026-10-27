// Stock phrases and images that make a lyric sound generic. Ode's own list of common idioms.

export interface Cliche {
  /** The phrase as shown to the musician. */
  phrase: string;
  pattern: RegExp;
}

/** "{my}" in a phrase matches any possessive, "{me}" any object pronoun. */
const PLACEHOLDERS: ReadonlyMap<string, string> = new Map([
  ["{my}", "(?:my|your|our|his|her|their|thy)"],
  ["{me}", "(?:me|you|us|him|her|them)"],
]);

function cliche(phrase: string): Cliche {
  let source = phrase.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  for (const [placeholder, group] of PLACEHOLDERS) source = source.replaceAll(placeholder, group);
  source = source.replace(/ /g, "\\s+");
  return { phrase: phrase.replace(/\{my\}/g, "my").replace(/\{me\}/g, "me"), pattern: new RegExp(`\\b${source}\\b`, "i") };
}

export const CLICHES: readonly Cliche[] = [
  "heart of stone",
  "broken heart",
  "break {my} heart",
  "breaking {my} heart",
  "tears fall like rain",
  "tears like rain",
  "tears in {my} eyes",
  "cold as ice",
  "set {me} free",
  "meant to be",
  "end of time",
  "stars in {my} eyes",
  "lost in {my} eyes",
  "fire in {my} heart",
  "fire in {my} soul",
  "light up the sky",
  "light up the night",
  "touch the sky",
  "reach for the stars",
  "take {my} breath away",
  "can't live without you",
  "lost without you",
  "never let {me} go",
  "deep in {my} soul",
  "rest of {my} life",
  "love of {my} life",
  "light of {my} life",
  "cross {my} mind",
  "by {my} side",
  "head over heels",
  "after the storm",
  "every step of the way",
  "written in the stars",
  "the stars align",
  "from the start",
  "chasing {my} dreams",
  "follow {my} heart",
  "a dream come true",
  "time stood still",
  "worlds apart",
  "belong together",
  "thick and thin",
  "hand in hand",
  "side by side",
  "now or never",
  "one more chance",
  "drive {me} crazy",
  "down on {my} knees",
  "stand the test of time",
  "shine like a star",
  "like a diamond",
  "burning desire",
  "under the moonlight",
  "lonely nights",
  "empty heart",
  "shattered dreams",
  "piece of {my} heart",
  "the one for {me}",
  "made for each other",
  "until the end",
  "fade away",
  "in {my} arms tonight",
  "a love like ours",
  "wings to fly",
  "ocean of tears",
  "storm inside",
  "heart on {my} sleeve",
  "rollercoaster ride",
].map(cliche);
