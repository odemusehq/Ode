import { t } from "../../shared/i18n";
import { ProductionTaskReadSchema, ProductionTaskUpdateSchema, ProductionTaskPatchSchema, type ProductionTask, type ProductionTaskRead } from "../../shared/production-task";
import { defineTool, type AnyTool } from "../define";

const preview = (text: string, size: number) => text.slice(0, size);
const header = (task: ProductionTask) => ({ taskId: task.id, revision: task.revision, songId: task.songId, status: task.status });
const acknowledge = (task: ProductionTask) => ({ ...header(task), stepCount: task.steps.length, stepIds: task.steps.map((step) => step.id) });

/** Admit complete JSON before the loop's final result cap; a cut string is not a usable checkpoint page. */
function bounded<T>(result: T, maxChars: number): T {
  if (JSON.stringify(result).length > maxChars) throw new Error("This production detail exceeds the configured tool result limit. Read an overview or one step/evidence page, or increase that limit.");
  return result;
}

function page<T>(key: "steps" | "evidence", items: T[], offset: number, limit: number, base: Record<string, unknown>, maxChars: number) {
  const selected: T[] = [];
  const result = () => ({ ...base, [key]: selected, offset, nextOffset: offset + selected.length < items.length ? offset + selected.length : null });
  for (const item of items.slice(offset, offset + limit)) {
    selected.push(item);
    if (JSON.stringify(result()).length > maxChars) { selected.pop(); break; }
  }
  if (!selected.length && offset < items.length) throw new Error("One production item exceeds the configured tool result limit. Read its separate step/evidence detail or increase that limit.");
  return bounded(result(), maxChars);
}

function readTask(task: ProductionTask, input: ProductionTaskRead, maxChars: number) {
  const detail = input.detail ?? "overview";
  const base = header(task);
  if (detail === "task") return bounded({ ...base, goal: task.goal, brief: task.brief, blocker: task.blocker,
    inspectionReason: task.inspectionReason, stepCount: task.steps.length, exchangeCount: task.exchangeIds.length, versionCount: task.versionIds.length }, maxChars);
  if (detail === "overview") {
    if (input.stepId) throw new Error("Use detail step or evidence with a stepId.");
    const steps = task.steps.map((step) => ({ id: step.id, status: step.status,
      actionPreview: preview(step.action, 240), actionTruncated: step.action.length > 240,
      targetTagsPreview: step.targetTags.slice(0, 3).map((tag) => preview(tag, 120)), targetCount: step.targetTags.length,
      evidenceCount: step.evidence.length, ...(step.blocker ? { blockerPreview: preview(step.blocker, 240) } : {}),
    }));
    return page("steps", steps, input.offset ?? 0, input.limit ?? 6, { ...base, goal: task.goal,
      briefPreview: preview(task.brief, 500), briefTruncated: task.brief.length > 500, stepCount: task.steps.length,
      ...(task.blocker ? { blockerPreview: preview(task.blocker, 240) } : {}),
      ...(task.inspectionReason ? { inspectionReasonPreview: preview(task.inspectionReason, 240) } : {}),
    }, maxChars);
  }
  const step = task.steps.find((step) => step.id === input.stepId);
  if (!step) throw new Error("Give a current stepId from the production overview.");
  if (detail === "step") {
    const { evidence, ...fields } = step;
    return bounded({ ...base, step: fields, evidenceCount: evidence.length }, maxChars);
  }
  return page("evidence", step.evidence, input.offset ?? 0, input.limit ?? 1,
    { ...base, stepId: step.id, evidenceCount: step.evidence.length }, maxChars);
}

const { exchangeId: _exchangeId, ...patchInput } = ProductionTaskPatchSchema.shape;

export const productionTaskTools: AnyTool[] = [
  defineTool({
    name: "production_task_read",
    changes: "none",
    alwaysLoad: true,
    description: "Read the current song's durable checkpoint in complete JSON pages. Default detail overview returns the goal, explicit previews/counts and up to six steps; follow nextOffset without changing revision to read all step ids. detail task gives the exact goal/brief and task blocker; detail step with stepId gives exact action, status, targets and blocker; detail evidence with stepId pages that step's citations (one by default). offset/limit select overview steps or evidence, and pages may shrink to fit the tool result limit. null means no checkpoint. Use taskId/revision for writes. Read and inspect actual targets before resuming; saved observations do not establish later currentness, artistic quality or tool replay authority.",
    input: ProductionTaskReadSchema.shape,
    run: async (input, ctx) => {
      const task = await ctx.production.read();
      return task ? readTask(task, input, ctx.config.limits.toolResultMaxChars) : null;
    },
  }),
  defineTool({
    name: "production_task_update",
    changes: "memory",
    alwaysLoad: true,
    mainAgentOnly: true,
    description: "Create or revise the full production checkpoint, without performing its steps. First plan: baseRevision 0 and omit taskId; otherwise give current taskId/revision, goal, shared brief and whole ordered steps (up to 24). Keep existing ids, especially every unfinished step: normal omission is refused. For a genuinely different scope use replace true with current id/revision; the previous task is archived. At most one step is working. Complete steps only with cited saved evidence: tool {exchangeId,toolCallId,summary,targets}, version {versionId,summary,targets}, musician {exchangeId,quote,summary,targets}, each with kind. Sources and targets are checked; success alone does not prove the musical goal. Blocked steps need a blocker. Prefer production_task_patch for focused progress without resending large evidence. Returns a compact acknowledgement; read pages for detail. Never store private reasoning or replay instructions.",
    input: ProductionTaskUpdateSchema.omit({ exchangeId: true }).shape,
    describe: ({ goal }) => t("toolActivity.productionPlan", { goal: goal }),
    run: async (input, ctx) => {
      if (!ctx.exchangeId) throw new Error("A production checkpoint needs the current accepted request's exchange id.");
      return bounded(acknowledge(await ctx.production.update({ ...input, exchangeId: ctx.exchangeId })), ctx.config.limits.toolResultMaxChars);
    },
  }),
  defineTool({
    name: "production_task_patch",
    changes: "memory",
    alwaysLoad: true,
    mainAgentOnly: true,
    description: "Patch the current production checkpoint with taskId and baseRevision from a read. Supply only changed goal/brief/task blocker, or steps [{id, action?, status?, targetTags?, evidence?, blocker?}] for existing step ids. appendSteps adds new step objects without ids, up to 24 total steps. Omitted fields, other steps and their evidence stay unchanged; supplied targetTags/evidence arrays replace those fields, and blocker null clears a resolved blocker. Completion uses the same saved-source and target checks as full update. One working step maximum; patch old/new working statuses together when advancing. This saves the checkpoint, never executes host work. Returns a compact acknowledgement. Genuine goal replacement archives the old task.",
    input: patchInput,
    describe: () => t("toolActivity.productionPlanUpdateProgress"),
    run: async (input, ctx) => {
      if (!ctx.exchangeId) throw new Error("A production checkpoint needs the current accepted request's exchange id.");
      return bounded(acknowledge(await ctx.production.patch({ ...input, exchangeId: ctx.exchangeId })), ctx.config.limits.toolResultMaxChars);
    },
  }),
];
