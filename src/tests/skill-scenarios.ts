import { mkdtemp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OdeAgents } from "../agents/agents";
import { Approvals, Decision } from "../harness/approvals";
import { AgentLoop } from "../harness/loop";
import { OdeSession } from "../harness/session";
import { SkillLibrary } from "../harness/skills";
import { FolderTexts } from "../harness/texts";
import { ToolLabels } from "../harness/tool-labels";
import { ConversationStore } from "../mneme/conversations";
import { Mneme } from "../mneme/artist";
import { LyricsStore } from "../mneme/lyrics-store";
import { TempFolder, userPaths } from "../mneme/paths";
import { PreferencesStore } from "../mneme/preferences";
import { SetDiff } from "../mneme/set-diff";
import { SettingsStore } from "../mneme/settings-store";
import { SongStore, SongVersions } from "../mneme/song-store";
import { ContextSummary } from "../mneme/summary";
import { DeletionChecker } from "../server/deletion-checker";
import { Questions } from "../server/questions";
import { RequestContext } from "../server/request-context";
import { SelectionState } from "../server/selection";
import { SnapshotReader } from "../server/snapshot-reader";
import { SuggestionFinder } from "../server/suggestions";
import { VersionRecorder } from "../server/version-recorder";
import { ModelServices } from "../services";
import { ModelRoles } from "../services/model-roles";
import { ProviderCatalog } from "../services/provider-catalog";
import type { RoleSource } from "../services/types";
import { OdeConfig } from "../shared/config";
import { ConfigError, DevConfig } from "../shared/dev-config";
import type { UiEvent } from "../shared/events";
import type { SetSnapshot } from "../shared/set-snapshot";
import { LeadSheetSchema, type LeadSheet } from "../shared/song";
import { ToolRegistry } from "../tools";
import { FakeSetLive } from "./fake-set-live";
import { TestSets } from "./sets";

/** The settings block at the top of prompt.md and of each grader. */
const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/;
const INPUT_FILES_LINE = /^Input files:.*$/m;
/** Long values in the trace are cut to this many characters, so the judge reads the whole trace. */
const TRACE_VALUE_CHARS = 1500;
const JUDGE_MAX_TOKENS = 600;
const JUDGE_SYSTEM =
  "You grade one statement about what Ode, an AI co-producer inside Ableton Live, did after a musician's action. " +
  "Judge only from the trace. Answer with JSON only: {\"passed\": true or false, \"evidence\": \"one sentence citing the trace\"}.";

/** One skill's scenario: the musician's action on a known Set, and the statements a good result makes true. */
class ScenarioCase {
  private constructor(
    readonly skill: string,
    readonly name: string,
    readonly action: string,
    readonly set: SetSnapshot,
    readonly sheet: LeadSheet | null,
    readonly graders: string[],
  ) {}

  /** Every case folder under skills/<skill>/evals/, for the skills named (all when none are). */
  static async all(skillsDir: string, only: string[]): Promise<ScenarioCase[]> {
    const cases: ScenarioCase[] = [];
    for (const skill of (await readdir(skillsDir)).sort()) {
      if (only.length > 0 && !only.includes(skill)) continue;
      const evals = join(skillsDir, skill, "evals");
      const names = await readdir(evals).catch(() => [] as string[]);
      for (const name of names.sort()) {
        if (await ScenarioCase.isCase(join(evals, name))) cases.push(await ScenarioCase.load(skill, name, join(evals, name)));
      }
    }
    return cases;
  }

  private static async isCase(dir: string): Promise<boolean> {
    return stat(join(dir, "case.yaml")).then(
      () => true,
      () => false,
    );
  }

  private static async load(skill: string, name: string, dir: string): Promise<ScenarioCase> {
    const prompt = (await readFile(join(dir, "prompt.md"), "utf8")).replace(FRONT_MATTER, "").replace(INPUT_FILES_LINE, "").trim();
    const set = JSON.parse(await readFile(join(dir, "files", "set.json"), "utf8")) as SetSnapshot;
    const song = await readFile(join(dir, "files", "song.json"), "utf8").catch(() => null);
    const graderFiles = (await readdir(join(dir, "graders"))).filter((file) => file.endsWith(".md")).sort();
    const graders = await Promise.all(graderFiles.map(async (file) => (await readFile(join(dir, "graders", file), "utf8")).replace(FRONT_MATTER, "").trim()));
    return new ScenarioCase(skill, name, prompt, set, song ? LeadSheetSchema.parse(JSON.parse(song)) : null, graders);
  }
}

/** What happened in one run, in the words and data the judge reads. */
interface Trace {
  action: string;
  reply: string;
  questions: string[];
  approvals: string[];
  tools: string[];
  progress: string[];
  liveCalls: string[];
  changes: { label: string; before?: string; after?: string }[];
  played: boolean;
}

/** Runs one case with the real agent and tools against the fake Set, wired as the server wires them. */
class ScenarioRun {
  constructor(
    private readonly scenario: ScenarioCase,
    private readonly roles: RoleSource,
  ) {}

  async trace(): Promise<Trace> {
    const userDir = await mkdtemp(join(tmpdir(), `ode-scenario-${this.scenario.name}-`));
    const config = new OdeConfig(join(userDir, "storage"), join(userDir, "temp"));
    const events: UiEvent[] = [];
    const questions: Questions = new Questions((event) => this.onEvent(event, events, questions, approvals));
    const approvals: Approvals = new Approvals((event) => this.onEvent(event, events, questions, approvals));
    const emit = (event: UiEvent) => this.onEvent(event, events, questions, approvals);
    const paths = userPaths(config.userDir);
    const prefs = new PreferencesStore(join(paths.preferences, "preferences.json"));
    const mneme = new Mneme(paths, config.memory.halfLifeDays);
    const song = new SongStore(paths, () => undefined);
    const lyrics = new LyricsStore(song, prefs, (state) => emit({ type: "lyrics", lyrics: state }));
    await song.create(this.scenario.name);
    if (this.scenario.sheet) {
      await song.replace(this.scenario.sheet);
      await lyrics.replace(this.scenario.sheet.lyrics);
    }
    const versions = new SongVersions(song, config.versions.snapshotEvery);
    const live = new FakeSetLive(this.scenario.set, TestSets.liveDevices());
    const reader = new SnapshotReader(live, song);
    const recorder = new VersionRecorder(reader, versions, emit);
    const selection = new SelectionState({ reader, versions, finder: new SuggestionFinder(live, song, prefs), busy: () => false, emit });
    const services = new ModelServices(this.roles);
    const temp = new TempFolder(config.tempDir);
    const registry = new ToolRegistry({ config, live, song, lyrics, versions, snapshots: reader, questions, mneme, prefs, services, temp, emit });
    const requests = new RequestContext({
      config,
      live,
      reader,
      recorder,
      versions,
      summary: new ContextSummary(mneme, song, prefs, config.memory.summaryMaxChars),
      prefs,
      selection,
      emit,
    });
    const texts = new FolderTexts(DevConfig.repoDir);
    const skills = new SkillLibrary(texts);
    const agents = new OdeAgents(texts, skills);
    const labels = new ToolLabels(registry);
    const loop = new AgentLoop({ services, registry, skills, labels, limits: config.limits, subagentPrompt: () => agents.subagentPrompt() });
    const deletions = new DeletionChecker(reader);
    const conversations = new ConversationStore(join(paths.workspace, "conversations"), config.limits.historyExchanges);
    const session = new OdeSession(
      { loop, agents, labels, approvals, questions, prefs, requests, deletions, snapshots: reader, emit },
      conversations.log(this.scenario.name),
    );
    const before = await reader.read();
    await session.send({ text: this.scenario.action });
    const after = await reader.read();
    return ScenarioRun.describe(this.scenario.action, events, live, SetDiff.between(before, after).map((change) => ({ label: change.label, before: ScenarioRun.cut(change.before), after: ScenarioRun.cut(change.after) })));
  }

  /** Questions get their first answer and changes waiting for approval are skipped, so a run never waits for a person. */
  private onEvent(event: UiEvent, events: UiEvent[], questions: Questions, approvals: Approvals): void {
    events.push(event);
    if (event.type === "question") questions.answer(event.id, event.options[0] ?? "");
    if (event.type === "approval") approvals.decide(event.id, Decision.Deny);
  }

  private static describe(action: string, events: UiEvent[], live: FakeSetLive, changes: Trace["changes"]): Trace {
    const results = events.flatMap((event) => (event.type === "result" ? [event.text] : []));
    return {
      action,
      reply: results.at(-1) ?? "",
      questions: events.flatMap((event) =>
        event.type === "question" ? [`${event.text} [${event.options.join(" / ")}]${event.images ? ` images: ${event.images.join(", ")}` : ""}`] : [],
      ),
      approvals: events.flatMap((event) => (event.type === "approval" ? [`${event.tool}: ${event.summary}`] : [])),
      tools: events.flatMap((event) => (event.type === "tool" && event.status === "started" ? [`${event.name}${event.summary ? `: ${event.summary}` : ""}`] : [])),
      progress: events.flatMap((event) => (event.type === "progress" ? [event.text] : [])),
      liveCalls: live.calls.map(({ op, args }) => `${op} ${ScenarioRun.cut(args) ?? ""}`),
      changes,
      played: live.calls.some(({ op }) => op === "transport_play"),
    };
  }

  private static cut(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    const text = JSON.stringify(value);
    return text.length > TRACE_VALUE_CHARS ? `${text.slice(0, TRACE_VALUE_CHARS)}…` : text;
  }
}

/** Judges each grader statement against a run's trace with the subagent model. */
class ScenarioJudge {
  constructor(private readonly services: ModelServices) {}

  async grade(trace: Trace, statement: string): Promise<{ passed: boolean; evidence: string }> {
    const prompt = `Trace:\n${JSON.stringify(trace, null, 2)}\n\nStatement: ${statement}`;
    const answer = await this.services.text("subagent", prompt, { system: JUDGE_SYSTEM, maxTokens: JUDGE_MAX_TOKENS });
    const json = answer.slice(answer.indexOf("{"), answer.lastIndexOf("}") + 1);
    try {
      const parsed = JSON.parse(json) as { passed?: unknown; evidence?: unknown };
      return { passed: parsed.passed === true, evidence: String(parsed.evidence ?? "") };
    } catch {
      return { passed: false, evidence: `The judge's answer wasn't JSON: ${answer.slice(0, TRACE_VALUE_CHARS)}` };
    }
  }
}

/** Runs the scenarios of the skills named on the command line (all when none are) and reports each statement. */
class ScenarioSuite {
  async run(only: string[]): Promise<number> {
    let config: DevConfig;
    try {
      config = DevConfig.load();
    } catch (error) {
      if (error instanceof ConfigError) return ScenarioSuite.skip(error.message);
      throw error;
    }
    // The developer's own Settings, kept as settings.json in the Ode folder named in .env.
    const roles = new ModelRoles(new SettingsStore(config.userDir, ProviderCatalog.bundled), ProviderCatalog.bundled);
    const services = new ModelServices(roles);
    if (!(await services.available()).main) return ScenarioSuite.skip("the main model needs a provider, model and key: choose them in Ode: Settings.");
    const judge = new ScenarioJudge(services);
    const cases = await ScenarioCase.all(join(DevConfig.repoDir, "skills"), only);
    const report: { skill: string; case: string; trace: Trace | null; error?: string; grades: { statement: string; passed: boolean; evidence: string }[] }[] = [];
    let failed = 0;
    for (const scenario of cases) {
      console.log(`\n${scenario.skill} / ${scenario.name}: "${scenario.action}"`);
      try {
        const trace = await new ScenarioRun(scenario, roles).trace();
        const grades = [];
        for (const statement of scenario.graders) {
          const grade = await judge.grade(trace, statement);
          if (!grade.passed) failed += 1;
          console.log(`  ${grade.passed ? "pass" : "FAIL"}  ${statement}\n        ${grade.evidence}`);
          grades.push({ statement, ...grade });
        }
        console.log(`  reply: ${trace.reply}`);
        report.push({ skill: scenario.skill, case: scenario.name, trace, grades });
      } catch (error) {
        failed += scenario.graders.length;
        const message = error instanceof Error ? error.message : String(error);
        console.log(`  FAIL  the run stopped: ${message}`);
        report.push({ skill: scenario.skill, case: scenario.name, trace: null, error: message, grades: [] });
      }
    }
    const file = join(await mkdtemp(join(tmpdir(), "ode-skill-scenarios-")), "report.json");
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`\n${cases.length} scenarios, ${failed} statements not met. Full report: ${file}`);
    return failed === 0 ? 0 : 1;
  }

  private static skip(reason: string): number {
    console.log(`Skill scenarios skipped: ${reason.replace(/\.?$/, ".")} They run the real agent, so they need the model settings in .env.`);
    return 0;
  }
}

process.exitCode = await new ScenarioSuite().run(process.argv.slice(2));
