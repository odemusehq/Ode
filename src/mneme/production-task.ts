import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ProductionTaskSchema, ProductionTaskUpdateSchema, type ProductionEvidence, type ProductionStep, type ProductionTask, type ProductionTaskUpdate } from "../shared/production-task";
import { JsonFile } from "./json-file";
import type { SongStore } from "./song-store";

/** Checks that a citation exists for this song and covers the step's targets, not whether the music is good. */
export type ProductionEvidenceVerifier = (evidence: ProductionEvidence, songId: string, step: ProductionStep) => Promise<boolean>;

interface SongTask {
  songId: string;
  dir: string;
  file: JsonFile<ProductionTask | null>;
  queue: Promise<unknown>;
}

/** One current production checkpoint per song, with completed and unfinished replacements retained on disk. */
export class ProductionTaskStore {
  private readonly songs = new Map<string, SongTask>();

  constructor(
    private readonly song: Pick<SongStore, "songId" | "dataDir">,
    private readonly verifyEvidence?: ProductionEvidenceVerifier,
  ) {}

  read(): Promise<ProductionTask | null> {
    const song = this.current();
    return this.enqueue(song, () => song.file.read());
  }

  /** Writes a revised plan only; no scheduler, retry or replay of previous operations runs here. */
  update(input: ProductionTaskUpdate): Promise<ProductionTask> {
    const song = this.current();
    const update = ProductionTaskUpdateSchema.parse(input);
    return this.enqueue(song, async () => {
      const previous = await song.file.read();
      if (update.baseRevision !== (previous?.revision ?? 0) || update.taskId !== previous?.id) {
        throw new Error("The production task or revision changed. Read production_task_read and revise the current plan.");
      }
      const replacing = update.replace === true;
      const known = new Map((replacing ? [] : previous?.steps ?? []).map((step) => [step.id, step]));
      const steps: ProductionStep[] = update.steps.map((step) => {
        if (step.id && !known.has(step.id)) throw new Error("That production step belongs to another plan. Leave id out for a new step.");
        return { ...step, id: step.id ?? randomUUID() };
      });
      if (new Set(steps.map((step) => step.id)).size !== steps.length) throw new Error("Each production step needs its own id.");
      if (steps.filter((step) => step.status === "working").length > 1) throw new Error("Keep one current production step; independent drafts can use read-only subagents.");
      if (update.blocker && steps.every((step) => step.status === "complete")) throw new Error("A production task with a blocker is unfinished. Keep the required action as an unfinished step, or remove the resolved blocker.");
      for (const step of steps) {
        if (step.status === "blocked" && !step.blocker) throw new Error("A blocked production step needs its concrete blocker.");
        if (step.status !== "complete") continue;
        if (step.blocker) throw new Error("A completed production step cannot keep a blocker. Remove it only when the blocker is resolved.");
        if (step.evidence.length === 0) throw new Error("A completed production step needs cited evidence from the actual work, not a tool success flag.");
        const old = known.get(step.id);
        if (old?.status === "complete" && JSON.stringify(old) === JSON.stringify(step)) continue;
        for (const evidence of step.evidence) {
          if (!this.verifyEvidence || !(await this.verifyEvidence(evidence, song.songId, step))) {
            throw new Error("The completed step's evidence could not be verified for this song and target. Inspect the current material and cite a saved observation.");
          }
        }
      }
      const now = new Date().toISOString();
      const task = ProductionTaskSchema.parse({
        version: 1,
        id: replacing || !previous ? randomUUID() : previous.id,
        songId: song.songId,
        revision: replacing || !previous ? 1 : previous.revision + 1,
        goal: update.goal,
        brief: update.brief,
        steps,
        status: ProductionTaskStore.status(steps, update.blocker),
        ...(update.blocker ? { blocker: update.blocker } : {}),
        exchangeIds: ProductionTaskStore.links(replacing ? [] : previous?.exchangeIds ?? [], update.exchangeId),
        versionIds: ProductionTaskStore.links(replacing ? [] : previous?.versionIds ?? [], update.versionId),
        createdAt: replacing || !previous ? now : previous.createdAt,
        updatedAt: now,
      });
      if (replacing && previous) {
        const archive = new JsonFile(join(song.dir, "production-tasks", `${previous.id}.json`), ProductionTaskSchema, () => previous);
        await archive.write(previous);
      }
      await song.file.write(task);
      return task;
    });
  }

  /** Stop/restart keeps the goal and work, but never treats an issued operation as proof of completion. */
  interrupt(reason = "Interrupted. Inspect the current Set and saved observations before continuing."): Promise<ProductionTask | null> {
    const song = this.current();
    return this.enqueue(song, async () => {
      const task = await song.file.read();
      if (!task || task.status === "complete" || task.status === "needs-inspection") return task;
      const changed = ProductionTaskSchema.parse({
        ...task,
        revision: task.revision + 1,
        status: "needs-inspection",
        inspectionReason: reason,
        steps: task.steps.map((step) => step.status === "working" ? { ...step, status: "needs-inspection" } : step),
        updatedAt: new Date().toISOString(),
      });
      await song.file.write(changed);
      return changed;
    });
  }

  recover(): Promise<ProductionTask | null> {
    return this.interrupt("Ode restarted or this song reopened. Inspect the actual Set before continuing; saved steps are not replayed.");
  }

  /** Capture both getters before the first await: late writes must still land in their original song. */
  private current(): SongTask {
    const songId = this.song.songId;
    const dir = this.song.dataDir;
    if (!songId || !dir) throw new Error("Open an Ode song before reading its production task.");
    let entry = this.songs.get(dir);
    if (!entry) {
      entry = { songId, dir, file: new JsonFile(join(dir, "production-task.json"), ProductionTaskSchema.nullable(), () => null), queue: Promise.resolve() };
      this.songs.set(dir, entry);
    }
    return entry;
  }

  private enqueue<T>(song: SongTask, work: () => Promise<T>): Promise<T> {
    const run = song.queue.then(work, work);
    song.queue = run.catch(() => undefined);
    return run;
  }

  private static status(steps: ProductionStep[], blocker: string | null | undefined): ProductionTask["status"] {
    if (steps.every((step) => step.status === "complete")) return "complete";
    if (steps.some((step) => step.status === "needs-inspection")) return "needs-inspection";
    if (steps.some((step) => step.status === "working")) return "working";
    if (blocker || steps.some((step) => step.status === "blocked")) return "blocked";
    return "planned";
  }

  private static links(existing: string[], added: string | undefined): string[] {
    return added ? [...new Set([...existing, added])].slice(-100) : existing;
  }
}
