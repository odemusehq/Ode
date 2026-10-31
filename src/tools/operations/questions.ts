import { z } from "zod";
import { defineTool } from "../define";
export const askMusician = defineTool({
 name: "ask_musician", alwaysLoad: true, mainAgentOnly: true, changes: "none",
 description: "Ask the musician a concise question when the answer changes the work. Offer two to four brief choices. A typed reply also answers it.",
 input: { question: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(4) },
 run: async ({ question, options }, ctx) => ({ answer: await ctx.questions.ask(question, options) }),
});
