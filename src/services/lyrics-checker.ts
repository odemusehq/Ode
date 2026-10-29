import { z } from "zod";
import type { TextLibrary } from "../harness/texts";
import type { LyricsSupportSettings } from "../shared/config";
import type { LyricsCheck, LyricsCheckResponse } from "../shared/lyrics";
import type { Accent } from "../shared/personalisation";
import type { ModelServices } from "./index";

const LyricsCheckSchema = z.object({
  lines: z.array(
    z.object({
      words: z.array(z.object({ text: z.string(), syllables: z.array(z.string()), stress: z.array(z.number().int()) })),
      rhyme: z.object({ letter: z.string(), quality: z.enum(["perfect", "near", "none"]), part: z.string() }),
    }),
  ),
});

/** The strict schema the provider holds the answer to: every object closed, every key required. */
const CHECK_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["words", "rhyme"],
        properties: {
          words: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "syllables", "stress"],
              properties: {
                text: { type: "string" },
                syllables: { type: "array", items: { type: "string" } },
                stress: { type: "array", items: { type: "integer", enum: [0, 1, 2] } },
              },
            },
          },
          rhyme: {
            type: "object",
            additionalProperties: false,
            required: ["letter", "quality", "part"],
            properties: {
              letter: { type: "string" },
              quality: { type: "string", enum: ["perfect", "near", "none"] },
              part: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const ACCENT_NAMES: Readonly<Record<Accent, string>> = { uk: "UK English", us: "US English" };
const UNMARKED: LyricsCheck["lines"][number] = { words: [], rhyme: { letter: "", quality: "none", part: "" } };

/**
 * Lyrics support: asks the model chosen in Settings for a section's syllables, stress and rhymes, in a fixed JSON shape
 * at the model's lowest reasoning effort, and keeps each answer by section so text seen before is marked at once.
 */
export class LyricsChecker {
  private static readonly INSTRUCTION = "src/agents/lyrics-check.md";
  private readonly checked = new Map<string, LyricsCheck>();

  constructor(
    private readonly services: ModelServices,
    private readonly texts: TextLibrary,
    private readonly settings: LyricsSupportSettings,
  ) {}

  async check(lines: string[], accent: Accent): Promise<LyricsCheckResponse> {
    if (lines.length === 0) return { status: "ok", check: { lines: [] } };
    const key = `${accent}\n${lines.join("\n")}`;
    const known = this.checked.get(key);
    if (known) return { status: "ok", check: known };
    if (!(await this.services.available()).lyrics_check) return { status: "setup" };
    try {
      const model = await this.services.chat("lyrics_check");
      const instruction = (await this.texts.read(LyricsChecker.INSTRUCTION)).replaceAll("{accent}", ACCENT_NAMES[accent]);
      const check = await model.json({
        name: "lyrics_check",
        schema: CHECK_SCHEMA,
        system: instruction,
        user: lines.map((line, index) => `${index + 1}. ${line}`).join("\n"),
        maxTokens: this.settings.maxTokens,
        parse: (value) => LyricsChecker.aligned(LyricsCheckSchema.parse(value), lines.length),
      });
      this.remember(key, check);
      return { status: "ok", check };
    } catch (error) {
      return { status: "unreachable", detail: error instanceof Error ? error.message : String(error) };
    }
  }

  /** One entry per line sent: a line the answer skipped reads as unmarked, and extra entries are dropped. */
  private static aligned(check: LyricsCheck, count: number): LyricsCheck {
    return { lines: Array.from({ length: count }, (_, index) => check.lines[index] ?? UNMARKED) };
  }

  /** Keeps the answer, letting the oldest go once the cache is full. */
  private remember(key: string, check: LyricsCheck): void {
    if (this.checked.size >= this.settings.cacheSize) {
      const oldest = this.checked.keys().next().value;
      if (oldest !== undefined) this.checked.delete(oldest);
    }
    this.checked.set(key, check);
  }
}
