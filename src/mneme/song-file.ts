import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LeadSheetSchema, emptyLeadSheet, type LeadSheet } from "../shared/song";
import { JsonFile } from "./json-file";
import { MusicXml } from "./musicxml";

/** One authoritative MusicXML document. Legacy JSON is read only while no MusicXML file exists. */
export class SongFile {
  readonly path: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly directory: string) { this.path = join(directory, "song.musicxml"); }

  async read(): Promise<LeadSheet> {
    let xml: string;
    try { xml = await readFile(this.path, "utf8"); }
    catch (error) {
      if (!JsonFile.isMissing(error)) throw error;
      try { return LeadSheetSchema.parse(JSON.parse(await readFile(join(this.directory, "song.json"), "utf8"))); }
      catch (legacyError) { if (JsonFile.isMissing(legacyError)) return emptyLeadSheet(); throw legacyError; }
    }
    // A damaged song stays intact and reports the problem. Never replace it with an empty song or old JSON.
    return MusicXml.read(xml);
  }

  write(sheet: LeadSheet): Promise<void> {
    return this.enqueue(async () => {
      const xml = MusicXml.write(sheet);
      MusicXml.read(xml);
      await JsonFile.writeAtomically(this.path, xml);
    });
  }
  update(change: (sheet: LeadSheet) => LeadSheet): Promise<LeadSheet> {
    return this.enqueue(async () => {
      const next = change(await this.read());
      const xml = MusicXml.write(next);
      const parsed = MusicXml.read(xml);
      await JsonFile.writeAtomically(this.path, xml);
      return parsed;
    });
  }
  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
