import { readFile, writeFile } from "node:fs/promises";
import type { RoleConfig } from "../shared/config";
import { Provider } from "./providers";
import type { DemoVocalInput } from "./types";

/**
 * What Ode sends to a singing voice server: the lyrics with the notes each line is sung on,
 * the tempo, and a short recording of the artist's own voice whose timbre the model copies.
 */
export interface SingRequest {
  model: string;
  tempo: number;
  lines: { text: string; notes: { pitch: number; start: number; duration: number }[] }[];
  voice: { wavBase64: string };
}

/**
 * Singing voice: a demo vocal in the artist's voice from a self-hosted singing voice synthesis model
 * (for example SoulX-Singer or VocalRender) that answers POST {baseUrl}/sing with WAV audio.
 */
export class SingingVoice {
  constructor(private readonly role: RoleConfig) {
    if (role.provider !== Provider.SelfHosted) throw new Error(`Singing voice supports the "self-hosted" provider, not "${role.provider}".`);
  }

  async sing(input: DemoVocalInput, outPath: string): Promise<string> {
    if (!input.voiceModel) throw new Error("No recording of the artist's voice yet: save one with voice_reference_set first.");
    const request: SingRequest = {
      model: this.role.model,
      tempo: input.tempo,
      lines: input.lines.map((line) => ({
        text: line.text,
        notes: line.notes.map(({ pitch, start, duration }) => ({ pitch, start, duration })),
      })),
      voice: { wavBase64: (await readFile(input.voiceModel)).toString("base64") },
    };
    const response = await fetch(`${this.role.baseUrl}/sing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.role.apiKey}`, "Content-Type": "application/json", Accept: "audio/wav" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`The singing voice server failed (${response.status}): ${await response.text()}`);
    await writeFile(outPath, Buffer.from(await response.arrayBuffer()));
    return outPath;
  }
}
