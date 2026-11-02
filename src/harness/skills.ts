import type { TextLibrary } from "./texts";

/** A skill as the agent's prompt lists it. */
export interface SkillSummary {
  name: string;
  description: string;
}

/**
 * Ode's skills: one folder per skill under skills/, each with a SKILL.md, sub-skills in nested folders
 * ("rhymes/pop") and reference files beside them. The agent reads them by name.
 */
export class SkillLibrary {
  private static readonly ROOT = "skills/";
  private static readonly SKILL_FILE = "SKILL.md";
  /** Test cases for the skills, kept out of the agent's reach. */
  private static readonly EVALS = "/evals/";
  private static readonly FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

  constructor(private readonly texts: TextLibrary) {}

  /** The top-level skills, with the description from each SKILL.md's front matter. */
  async index(): Promise<SkillSummary[]> {
    const paths = await this.texts.list(SkillLibrary.ROOT);
    const top = paths.filter((path) => path.split("/").length === 3 && path.endsWith(`/${SkillLibrary.SKILL_FILE}`)).sort();
    return Promise.all(
      top.map(async (path) => ({ name: path.split("/")[1] ?? path, description: SkillLibrary.describe(await this.texts.read(path)) })),
    );
  }

  /** A skill's SKILL.md ("rhymes", "rhymes/pop"), or one of the files in its folder ("references/meter.md"). */
  async read(name: string, file?: string): Promise<string> {
    const folder = SkillLibrary.clean(name);
    const path = `${SkillLibrary.ROOT}${folder}/${file ? SkillLibrary.clean(file) : SkillLibrary.SKILL_FILE}`;
    if (path.includes(SkillLibrary.EVALS)) throw new Error("Skill test cases stay with the skills' authors.");
    const known = await this.texts.list(SkillLibrary.ROOT);
    if (!known.includes(path)) {
      const skills = (await this.index()).map((skill) => skill.name).join(", ");
      throw new Error(`Ode's skills are: ${skills}. Read one of them, or a file its SKILL.md names.`);
    }
    return this.texts.read(path);
  }

  /** A path inside skills/, with its parts kept to plain names. */
  private static clean(path: string): string {
    return path
      .split("/")
      .filter((part) => part && part !== "." && part !== "..")
      .join("/");
  }

  private static describe(text: string): string {
    const header = SkillLibrary.FRONT_MATTER.exec(text)?.[1] ?? "";
    const line = header.split("\n").find((each) => each.startsWith("description:"));
    return line ? line.slice("description:".length).trim() : "";
  }
}
