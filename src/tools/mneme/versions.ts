import { z } from "zod";

import { defineTool, type AnyTool } from "../define";
export const versionTools: AnyTool[] = [
  defineTool({
    name: "version_list",
    changes: "none",
    description:
      "List the song's versions of the whole Set, newest first: when each was made, who made it (the musician by hand, or Ode), its name if it has one, a one-line summary, the tracks it touched and how many changes it holds. A version is saved before every request (what the musician changed by hand since the last one) and after every change Ode makes. Use it to work out what the musician did and when, for example whether a track was muted sessions ago and left alone, or a minute ago while another track was soloed. limit: how many to return, newest first (the most recent few by default; ask for more to look further back). Open one with version_get.",
    input: { limit: z.number().int().min(1).optional() },
    run: async ({ limit }, ctx) => (await ctx.versions.history.items()).slice(0, limit ?? ctx.config.versions.listLimit),
  }),
  defineTool({
    name: "version_get",
    changes: "none",
    description:
      "Open one version from version_list: every change it made, grouped by track, each with how it was before and after (notes, parameter values, mute, solo, clips and devices added or removed), plus changes to the song itself (tempo, key, time signature, locators, scenes) and to the lead sheet (the lyrics as one text before and after, sections, details). id: the version's id from version_list. Returns { version, tracks, song, beatsPerBar }.",
    input: { id: z.string().min(1) },
    run: ({ id }, ctx) => ctx.versions.history.detail(id),
  })
];
