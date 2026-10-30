import { ProductionTaskUpdateSchema } from "../../shared/production-task";
import { defineTool, type AnyTool } from "../define";

export const productionTaskTools: AnyTool[] = [
  defineTool({
    name: "production_task_read",
    changes: "none",
    alwaysLoad: true,
    description: "Read the current song's durable production checkpoint: goal, shared musical brief, ordered steps, target tags, cited observations, blockers and exchange/version links. null means no checkpoint yet. Read this before continuing long work, including after interruption; inspect the actual Set and lyrics before editing. The checkpoint is a plan and public receipt, never a tool replay or proof that saved work is still current.",
    input: {},
    run: (_input, ctx) => ctx.production.read(),
  }),
  defineTool({
    name: "production_task_update",
    changes: "memory",
    alwaysLoad: true,
    mainAgentOnly: true,
    description: "Save the song's current production checkpoint without performing its steps. Give baseRevision and taskId from production_task_read (for the first plan: baseRevision 0, omit taskId), goal, compact shared musical brief and the whole ordered steps list (up to 24). Keep existing step ids; omit id for new steps. At most one step is working. Complete a step only with cited saved evidence: tool {exchangeId,toolCallId,summary,targets}, version {versionId,summary,targets}, or musician {exchangeId,quote,summary,targets}, each with kind. Citations are checked for source and scope. A successful write means the action finished; use actual read observations to claim the requested state. Neither proves artistic quality or musician approval. A blocked step names its blocker. After interruption reconcile the actual Set before revising the plan. For a genuinely different goal set replace true, with the current id/revision: the previous task, finished or unfinished, is archived first. Actual musical material and decisions stay in Live and the lead sheet; never store private reasoning or future tool calls here.",
    input: ProductionTaskUpdateSchema.omit({ exchangeId: true }).shape,
    describe: ({ goal }) => `Production plan · ${goal}`,
    run: (input, ctx) => {
      if (!ctx.exchangeId) throw new Error("A production checkpoint needs the current accepted request's exchange id.");
      return ctx.production.update({ ...input, exchangeId: ctx.exchangeId });
    },
  }),
];
