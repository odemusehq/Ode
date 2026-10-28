import { z } from "zod";
import { Mode } from "../../shared/personalisation";
import { ProjectMap } from "../../mneme/project-map";
import { defineTool, type AnyTool } from "../define";

/** Two to four buttons under a one-line question. */
const OPTIONS = { min: 2, max: 4 } as const;

export const historyTools: AnyTool[] = [
  defineTool({
    name: "ask_musician",
    changes: "none",
    alwaysLoad: true,
    mainAgentOnly: true,
    description:
      'Ask the musician a one-line question with two to four answers shown as buttons, and wait for the one they tap. Ask only when the answer changes what you would do and the Set, the hand edits and the versions can\'t tell you: a track muted for no reason you can work out, or (in Auto mode) before deleting a part or rewriting a whole section. Never ask what you can try: make the change, the musician can Undo. question: one short line, no prose, e.g. "The guitar is muted — use it in the verse?". options: 2–4 short button labels, e.g. ["Use it", "Leave it out"]. Returns { choice } with the label they tapped. In Let me hear it mode it doesn\'t ask and returns { choice: null, note }: make your best guess and say so in your result line.',
    input: {
      question: z.string().min(1).describe("One short line"),
      options: z.array(z.string().min(1)).min(OPTIONS.min).max(OPTIONS.max).describe("2–4 short button labels"),
    },
    run: async ({ question, options }, ctx) => {
      if ((await ctx.prefs.mode()) === Mode.LetMeHearIt) {
        return { choice: null, note: "Mode is Let me hear it: make your best guess and say so in your result line." };
      }
      const choice = await ctx.questions.ask(question.replace(/\s+/g, " ").trim(), options);
      return choice === null ? { choice: null, note: "The musician stopped Ode instead of answering." } : { choice };
    },
  }),
  defineTool({
    name: "project_map_get",
    changes: "none",
    description:
      "Read the compact map of the whole project as it is now: every track with its mixer, devices and clips, the return tracks and the Main track, scenes, locators, tempo, time signature, key and scale, what is selected, the playhead and the loop. Every request to Ode already carries this map; use it when you start without it (as a subagent) or to see the Set again after big changes. The details behind the map come from the read tools (track_get, midi_clip_get_notes, device_get…). Returns { map }.",
    input: {},
    run: async (_input, ctx) => ({ map: ProjectMap.encode(await ctx.snapshots.read(), ctx.config.memory.mapMaxChars) }),
  }),
  defineTool({
    name: "version_list",
    changes: "none",
    description:
      "List the song's versions of the whole Set, newest first: when each was made, who made it (the musician by hand, or Ode), its name if it has one, a one-line summary, the tracks it touched and how many changes it holds. A version is saved before every request (what the musician changed by hand since the last one) and after every change Ode makes. Use it to work out what the musician did and when, for example whether a track was muted sessions ago and left alone, or a minute ago while another track was soloed. limit: how many to return, newest first (all when left out). Open one with version_get.",
    input: { limit: z.number().int().min(1).optional() },
    run: async ({ limit }, ctx) => {
      const items = await ctx.versions.history.items();
      return limit === undefined ? items : items.slice(0, limit);
    },
  }),
  defineTool({
    name: "version_get",
    changes: "none",
    description:
      "Open one version from version_list: every change it made, grouped by track, each with how it was before and after (notes, parameter values, mute, solo, clips and devices added or removed), plus changes to the song itself (tempo, key, time signature, locators, scenes). id: the version's id from version_list. Returns { version, tracks, song }.",
    input: { id: z.string().min(1) },
    run: ({ id }, ctx) => ctx.versions.history.detail(id),
  }),
];
