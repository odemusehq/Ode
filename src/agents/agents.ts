import type { SkillLibrary } from "../harness/skills";
import type { TextLibrary } from "../harness/texts";

/** Ode's main agent and its one kind of subagent: their prompts, each followed by the skills it can read. */
export class OdeAgents {
  private static readonly MAIN_PROMPT = "src/agents/ode.md";
  private static readonly SUBAGENT_PROMPT = "src/agents/subagent.md";
  private readonly prompts = new Map<string, Promise<string>>();

  constructor(
    private readonly texts: TextLibrary,
    private readonly skills: SkillLibrary,
  ) {}

  systemPrompt(): Promise<string> {
    return this.prompt(OdeAgents.MAIN_PROMPT);
  }

  subagentPrompt(): Promise<string> {
    return this.prompt(OdeAgents.SUBAGENT_PROMPT);
  }

  /** The prompt file with the list of skills appended, read once. */
  private prompt(path: string): Promise<string> {
    let prompt = this.prompts.get(path);
    if (!prompt) {
      prompt = Promise.all([this.texts.read(path), this.skills.index()]).then(
        ([text, index]) =>
          `${text.trim()}\n\n# Skills\n\nRead a skill with skill_read before the work it covers; its sub-skills are named in its table.\n\n${index
            .map((skill) => `- ${skill.name}: ${skill.description}`)
            .join("\n")}\n`,
      );
      this.prompts.set(path, prompt);
    }
    return prompt;
  }
}
