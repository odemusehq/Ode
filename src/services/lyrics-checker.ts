import { createHash } from "node:crypto";
import { z } from "zod";
import { JsonFile } from "../mneme/json-file";
import type { TextLibrary } from "../harness/texts";
import type { LyricsSupportSettings } from "../shared/config";
import type { LyricsCheck, LyricsCheckResponse } from "../shared/lyrics";
import type { Accent } from "../shared/personalisation";
import type { ModelServices } from "./index";
import type { TextGenerator } from "./capabilities";
import { LineCheckSchema, LyricsCheckSchema, type LyricsNotation } from "../shared/lyrics-document";
import { t } from "../shared/i18n";

/** The strict schema the provider holds the answer to: every object closed, every key required. */
const CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["words", "rhyme", "review"],
        properties: {
          review: { type: "array", items: { type: "string" } },
          words: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "syllables"],
              properties: {
                text: { type: "string" },
                syllables: { type: "array", minItems: 1, items: {
                  type: "object", additionalProperties: false, required: ["text", "wordStress", "stress", "ipa"],
                  properties: { text: { type: "string", minLength: 1 }, wordStress: { type: "integer", enum: [0, 1, 2] },
                    stress: { type: "integer", enum: [0, 1, 2] }, ipa: { type: "string" } },
                } },
              },
            },
          },
          rhyme: {
            type: "object",
            additionalProperties: false,
            required: ["letter", "quality", "part", "sound"],
            properties: {
              letter: { type: "string" },
              quality: { type: "string", enum: ["perfect", "near", "none"] },
              part: { type: "string" },
              sound: { type: "string" },
            },
          },
        },
      },
    },
  },
};

// The provider groups each reading with its syllable; storage and the editor retain their existing format.
const ModelWordSchema = z.object({ text: z.string(), syllables: z.array(z.object({ text: z.string().min(1),
  wordStress: z.number().int().min(0).max(2), stress: z.number().int().min(0).max(2), ipa: z.string() }).strict()).min(1) }).strict()
  .transform(({ text, syllables }) => ({ text, syllables: syllables.map(piece => piece.text), wordStress: syllables.map(piece => piece.wordStress),
    stress: syllables.map(piece => piece.stress), ipa: syllables.map(piece => piece.ipa) }));
const ModelCheckSchema = LyricsCheckSchema.extend({ lines: z.array(LineCheckSchema.extend({ words: z.array(ModelWordSchema), review: z.array(z.string()) })) });

const ACCENT_NAMES: Readonly<Record<Accent, string>> = { uk: "UK English", us: "US English" };
const SavedChecksSchema = z.array(z.object({ key: z.string(), check: LyricsCheckSchema }));

/**
 * Lyrics support: asks the model chosen in Settings for the whole song's syllables, stress and rhymes, in a fixed JSON shape
 * at the model's lowest reasoning effort, and caches only the exact whole input, accent and configured model.
 */
export class LyricsChecker {
  private static readonly INSTRUCTION = "src/agents/lyrics-check.md";
  private readonly checked = new Map<string, LyricsCheck>();
  private readonly pending = new Map<string, Promise<LyricsCheck>>();
  private readonly file?: JsonFile<z.infer<typeof SavedChecksSchema>>;
  /** ModelServices replaces an adapter whenever its provider, model, key or other role settings change. */
  private model: TextGenerator | undefined;

  constructor(
    private readonly services: ModelServices,
    private readonly texts: TextLibrary,
    private readonly settings: LyricsSupportSettings,
    cacheFile?: string,
  ) {
    if (cacheFile) this.file = new JsonFile(cacheFile, SavedChecksSchema, () => [], { mode: 0o600 });
  }

  /** Restore annotations with the lyrics without generating anything or waiting for a pending model call. */
  async cached(lines: string[], accent: Accent): Promise<LyricsCheck | undefined> {
    try {
      const context = await this.context(lines, accent);
      return context ? await this.known(context.key) : undefined;
    } catch { return undefined; }
  }

  async check(lines: string[], accent: Accent, signal?: AbortSignal, performance?: Pick<LyricsNotation, "choices" | "clips"> & { text?: string; request?: string; annotations?: LyricsCheck }): Promise<LyricsCheckResponse> {
    signal?.throwIfAborted();
    if (lines.length === 0) return { status: "ok", check: { lines: [] } };
    try {
      const context = await this.context(lines, accent, performance);
      signal?.throwIfAborted();
      if (!context) return { status: "setup" };
      const { key, model, instruction } = context;
      const known = await this.known(key);
      signal?.throwIfAborted();
      if (known) return { status: "ok", check: known };
      const generate = async () => {
        const check = await model.json({
          name: "lyrics_check",
          schema: { ...CHECK_SCHEMA, properties: { ...CHECK_SCHEMA.properties,
            lines: { ...CHECK_SCHEMA.properties.lines, minItems: lines.length, maxItems: lines.length } } },
          system: instruction,
          user: lines.map((line, index) => `${index + 1}. ${line}`).join("\n") + (performance ? `\n\nSaved artist choices, annotations and linked score (stored context):\n${JSON.stringify(performance)}` : ""),
          maxTokens: Math.max(this.settings.maxTokens, Math.min(24_000, lines.length * 600)),
          signal,
          parse: (value) => {
            const result = ModelCheckSchema.parse(value);
            if (result.lines.length !== lines.length) throw new Error(t("lyrics.document.checkLineCount", { actual: result.lines.length, expected: lines.length }));
            for (const [index, line] of result.lines.entries()) {
              const wrong = line.words.find(word => word.syllables.join("") !== word.text);
              if (wrong) throw new Error(t("lyrics.document.checkWordSpelling", { word: wrong.text, line: index + 1, spelled: wrong.syllables.join("") }));
              const source = lines[index]!;
              let cursor = 0;
              for (const word of line.words) {
                const at = source.indexOf(word.text, cursor);
                if (!word.text || at < 0 || /[\p{L}\p{M}\p{N}]/u.test(source.slice(cursor, at))) throw new Error(t("lyrics.document.checkLineWords", { line: index + 1 }));
                cursor = at + word.text.length;
              }
              if (/[\p{L}\p{M}\p{N}]/u.test(source.slice(cursor))) throw new Error(t("lyrics.document.checkLineWords", { line: index + 1 }));
            }
            return result;
          },
        });
        signal?.throwIfAborted();
        if (this.model !== model) throw new Error(t("lyrics.document.checkChanged"));
        // A response already in flight from an earlier provider must not enter the current model's cache.
        if (this.model === model) await this.remember(key, check);
        return check;
      };
      // Window requests have no cancellation signal: reopening shares the work already in progress.
      const running = !signal ? this.pending.get(key) : undefined;
      const request = running ?? generate();
      if (!signal && !running) {
        this.pending.set(key, request);
        void request.finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); }).catch(() => undefined);
      }
      const check = await request;
      return { status: "ok", check };
    } catch (error) {
      signal?.throwIfAborted();
      return { status: "unreachable", detail: error instanceof Error ? error.message : String(error) };
    }
  }

  private async context(lines: string[], accent: Accent, performance?: Pick<LyricsNotation, "choices" | "clips"> & { text?: string; request?: string; annotations?: LyricsCheck }) {
    if (!(await this.services.available()).lyrics_check) return undefined;
    const model = await this.services.chat("lyrics_check");
    if (this.model !== model) { this.checked.clear(); this.model = model; }
    const instruction = (await this.texts.read(LyricsChecker.INSTRUCTION)).replaceAll("{accent}", ACCENT_NAMES[accent]);
    const identity = this.file ? this.services.identity("lyrics_check", model) : "";
    const key = createHash("sha256").update(JSON.stringify([identity, instruction, accent, lines, ...(performance ? [performance] : [])])).digest("hex");
    return { key, model, instruction };
  }

  private async known(key: string): Promise<LyricsCheck | undefined> {
    const check = this.checked.get(key) ?? (await this.file?.read())?.find(entry => entry.key === key)?.check;
    if (check) this.checked.set(key, check);
    return check;
  }

  /** Keeps the answer, letting the oldest go once the cache is full. */
  private async remember(key: string, check: LyricsCheck): Promise<void> {
    if (this.checked.size >= this.settings.cacheSize) {
      const oldest = this.checked.keys().next().value;
      if (oldest !== undefined) this.checked.delete(oldest);
    }
    this.checked.set(key, check);
    await this.file?.update(entries => [...entries.filter(entry => entry.key !== key), { key, check }].slice(-this.settings.cacheSize));
  }
}
