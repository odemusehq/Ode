import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decode } from "../music/audio/decode";
import { writeWav } from "../music/audio/wav";

/** Where the recording came from in the Arrangement, kept with the artist's consent. */
export interface VoiceSource {
  track: unknown;
  start: number;
  end: number;
}

/**
 * The recording of the artist's voice that demo vocals are sung in, kept in the Voice folder together with the artist's
 * consent. The artist can withdraw it whenever they like, which removes both.
 */
export class VoiceReference {
  private static readonly RECORDING = "reference.wav";
  private static readonly CONSENT = "consent.json";

  constructor(private readonly folder: string) {}

  /** The recording, as a WAV file. */
  get recording(): string {
    return join(this.folder, VoiceReference.RECORDING);
  }

  private get consent(): string {
    return join(this.folder, VoiceReference.CONSENT);
  }

  /** True when both the recording and the artist's consent are saved. */
  async ready(): Promise<boolean> {
    return (await VoiceReference.present(this.recording)) && (await VoiceReference.present(this.consent));
  }

  /** Saves a render of the artist's singing as a WAV file, whichever format Live rendered it in, with their consent. */
  async save(render: string, source: VoiceSource): Promise<void> {
    await mkdir(this.folder, { recursive: true });
    await writeWav(this.recording, await decode(render));
    await writeFile(this.consent, `${JSON.stringify({ agreed: true, time: new Date().toISOString(), source }, null, 2)}\n`, "utf8");
  }

  /** The artist withdrew their consent: the recording and the consent go. */
  async clear(): Promise<void> {
    await rm(this.recording, { force: true });
    await rm(this.consent, { force: true });
  }

  private static present(path: string): Promise<boolean> {
    return stat(path).then(
      () => true,
      () => false,
    );
  }
}
