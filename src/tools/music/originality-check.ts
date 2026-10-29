import { z } from "zod";
import { originalityCheck, QuoteRisk } from "../../music/originality/originality-checker";
import { defineTool, type ToolContext } from "../define";

const WARNING = "These are warnings to weigh, with the legal call left to the musician: Ode's checks flag risks and stop short of proving a lyric original.";
const QUOTE_SYSTEM = "You review song lyrics for originality. Your answers hold only your own words and lines from the draft under review.";
const QuoteAnswer = z.object({
  possibleQuotes: z.array(z.object({ line: z.string(), reason: z.string() })),
});

interface QuoteCheck {
  done: boolean;
  possibleQuotes: { line: string; reason: string }[];
  note: string;
}

function quotePrompt(text: string): string {
  return [
    "Below is a new lyric draft. Say whether any of its lines looks like a quotation of a well-known existing song:",
    "the same distinctive wording, beyond a common phrase or idiom. Write only your own words: keep every existing",
    "lyric out of your answer, and leave songs and artists unnamed.",
    'Answer only with JSON: {"possibleQuotes":[{"line":"<the line from the draft>","reason":"<short reason in plain words>"}]}.',
    "Use an empty list when every line looks original.",
    "",
    "Draft:",
    "<<<",
    text,
    ">>>",
  ].join("\n");
}

function normalizeLine(line: string): string {
  return line.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
}

/** The model's JSON answer, or null when it is unreadable. */
function readAnswer(answer: string): z.infer<typeof QuoteAnswer> | null {
  try {
    const parsed = QuoteAnswer.safeParse(JSON.parse(answer.slice(answer.indexOf("{"), answer.lastIndexOf("}") + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Asks the subagent model whether any line looks like a quotation; only lines that are really in the draft count. */
async function checkQuotes(ctx: ToolContext, text: string): Promise<QuoteCheck> {
  let answer: string;
  try {
    answer = await ctx.services.text("subagent", quotePrompt(text), { system: QUOTE_SYSTEM });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { done: false, possibleQuotes: [], note: `The quotation check failed to run: ${reason}` };
  }
  const parsed = readAnswer(answer);
  if (!parsed) return { done: false, possibleQuotes: [], note: "The quotation check gave an unreadable answer." };
  const draftLines = new Set(text.split(/\r?\n/).map(normalizeLine));
  const possibleQuotes = parsed.possibleQuotes.filter((quote) => draftLines.has(normalizeLine(quote.line)));
  return {
    done: true,
    possibleQuotes,
    note: possibleQuotes.length > 0 ? "A model thinks these lines may echo existing songs." : "A model found zero lines that look quoted.",
  };
}

export const originalityCheckTool = defineTool({
  name: "originality_check",
  description: [
    "Checks a lyric for originality: clichéd phrases, over-used rhyme pairs at line ends (such as fire/desire),",
    "phrases repeated from the artist's own earlier songs (from memory), and, through a model, lines that may look like",
    "quotations of existing songs. The result is only a warning; say so when you pass it on.",
    "Use it on new or changed lyrics before reporting them, and when the musician asks whether a line is original.",
    "Inputs: text (the lyric, one line per line).",
    'Returns { cliches, repeats, overusedRhymes, quoteRisk ("low" or "possible"), quotationCheck { done,',
    "possibleQuotes [{ line, reason }], note }, warning }.",
  ].join(" "),
  input: {
    text: z.string().min(1).describe("The lyric to check, one line per line."),
  },
  changes: "none",
  async run({ text }, ctx) {
    const report = originalityCheck(text, await ctx.mneme.pastLyrics(ctx.song.songId));
    const quotationCheck = await checkQuotes(ctx, text);
    const quoteRisk = quotationCheck.possibleQuotes.length > 0 ? QuoteRisk.Possible : report.quoteRisk;
    return { ...report, quoteRisk, quotationCheck, warning: WARNING };
  },
});
