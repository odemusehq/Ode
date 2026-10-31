import { ProjectMap } from "../../../mneme/project-map";
import { defineTool, type AnyTool } from "../../define";
export const projectTools: AnyTool[] = [defineTool({
    name: "project_map_get",
    changes: "none",
    description:
      "Read the compact map of the whole project as it is now: every track with its mixer, devices and clips, the return tracks and the Main track, scenes, locators, tempo, time signature, key and scale. Every request to Ode already carries this map; use it when you start without it (as a subagent) or to see the Set again after big changes. The details behind the map come from the read tools (track_get, midi_clip_get_notes, device_get…). Returns { map }.",
    input: {},
    run: async (_input, ctx) => ({ map: ProjectMap.encode(await ctx.snapshots.read(), ctx.config.memory.mapMaxChars) }),
  })];
