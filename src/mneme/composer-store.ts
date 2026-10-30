import { createHash, randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { z } from "zod";
import { ComposerConflictSchema, ComposerDraftSchema, ComposerPendingSchema, type ComposerAttachment, type ComposerCancel, type ComposerConflict, type ComposerDraft, type ComposerPrepare, type ComposerResolve, type ComposerState, type ComposerWrite } from "../shared/composer";
import type { AudioFileInput, LocalAudioFiles, ManagedAudio } from "../live/local-audio-files";
import type { ConversationStore } from "./conversations";
import { JsonFile } from "./json-file";
import type { SongStore } from "./song-store";

const DocumentSchema = z.object({
  version: z.literal(1), songId: z.uuid(), revision: z.number().int().min(0), draft: ComposerDraftSchema,
  pending: ComposerPendingSchema.nullable(), conflicts: z.array(ComposerConflictSchema),
  lastWriterId: z.uuid().nullable().default(null),
  writes: z.array(z.object({ id: z.uuid(), hash: z.string(), conflict: z.boolean() })),
  writerHeads: z.array(z.object({ writerId: z.uuid(), sequence: z.number().int().min(0), draftHash: z.string(), conflict: z.boolean() })).default([]),
  cancelled: z.array(z.uuid()),
  accepted: z.array(z.object({ requestId: z.uuid(), textEditId: z.uuid(), textHash: z.string().default(""), snapshotHash: z.string().default(""), entryIds: z.array(z.uuid()) })),
  uploads: z.array(z.object({ entryId: z.uuid(), hash: z.string(), attachment: z.object({ entryId: z.uuid(), id: z.uuid(), name: z.string(), scope: z.enum(["sample", "reference", "processed-bounce"]) }) })),
});
type Document = z.infer<typeof DocumentSchema>;
interface SongFile { dir: string; file: JsonFile<Document>; queue: Promise<unknown> }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class ComposerError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 409, readonly composer?: ComposerState) { super(message); }
}

/** One unsent composer per song; this store never submits requests or enters model/version context. */
export class ComposerStore {
  private readonly files = new Map<string, SongFile>();

  constructor(private readonly songs: Pick<SongStore, "directoryFor">, private readonly conversations: ConversationStore, private readonly audio: LocalAudioFiles) {}

  async read(songId: string): Promise<ComposerState> {
    return this.withSong(songId, async (song) => this.state(await this.load(song, songId)));
  }

  async save(input: ComposerWrite): Promise<ComposerState> {
    return this.withSong(input.songId, async (song) => {
      const doc = await this.load(song, input.songId);
      if (this.repeated(doc, input.writeId, input)) return this.state(doc);
      const head = doc.writerHeads.find((item) => item.writerId === input.writerId);
      if (head && input.sequence <= head.sequence) {
        if (input.sequence === head.sequence && digest(input.draft) !== head.draftHash) throw new ComposerError("That draft edit sequence already belongs to different words.", 409, this.state(doc));
        if (input.sequence === head.sequence && head.conflict) throw new ComposerError("This save remains available as another saved draft.", 409, this.state(doc));
        return this.state(doc);
      }
      // An old keepalive save containing only delivered fields is an acknowledgement retry, not a new draft.
      if (this.textWasAccepted(input.draft, doc) &&
        input.draft.attachments.every((entry) => doc.accepted.some((item) => item.entryIds.includes(entry.entryId)))) {
        this.remember(doc, input.writeId, input);
        await song.file.write(doc);
        return this.state(doc);
      }
      const draft = this.removeAccepted(input.draft, doc);
      const containsAccepted = this.textWasAccepted(input.draft, doc) || doc.accepted.some((item) => item.entryIds.some((id) => input.draft.attachments.some((entry) => entry.entryId === id)));
      if (containsAccepted || input.baseRevision !== doc.revision && !same(draft, doc.draft)) {
        const conflict: ComposerConflict = { id: randomUUID(), writerId: input.writerId, draft, baseRevision: input.baseRevision, createdAt: new Date().toISOString() };
        doc.conflicts = [...doc.conflicts.filter((item) => item.writerId !== input.writerId), conflict];
        this.remember(doc, input.writeId, input, true);
        doc.revision++;
        await song.file.write(doc);
        throw new ComposerError("This draft changed in another window. Both drafts are saved; choose which to use.", 409, this.state(doc));
      }
      if (!same(doc.draft, draft)) { doc.draft = structuredClone(draft); doc.lastWriterId = input.writerId; doc.revision++; }
      this.remember(doc, input.writeId, input);
      await song.file.write(doc);
      return this.state(doc);
    });
  }

  async prepare(input: ComposerPrepare): Promise<ComposerState> {
    return this.withSong(input.songId, async (song) => {
      const doc = await this.load(song, input.songId);
      const accepted = doc.accepted.find((item) => item.snapshotHash ? item.snapshotHash === digest(input.snapshot) :
        item.textEditId === input.snapshot.textEditId && same(item.entryIds, input.snapshot.attachments.map((item) => item.entryId)));
      if (accepted) return { ...this.state(doc), acceptedRequestId: accepted.requestId };
      if (this.repeated(doc, input.writeId, input)) {
        if (!doc.pending || !same(doc.pending.snapshot, input.snapshot)) throw new ComposerError("That prepared send was stopped or replaced. Review the current draft before sending.", 409, this.state(doc));
        return this.state(doc);
      }
      if (input.baseRevision !== doc.revision) throw new ComposerError("The saved draft changed. Review the current draft before sending.", 409, this.state(doc));
      if (doc.pending && !same(doc.pending.snapshot, input.snapshot)) throw new ComposerError("An earlier send still awaits acknowledgement. Stop it before sending an edited draft.", 409, this.state(doc));
      if (this.textWasAccepted(input.snapshot, doc) || doc.accepted.some((item) => item.entryIds.some((id) => input.snapshot.attachments.some((entry) => entry.entryId === id)))) throw new ComposerError("Part of this draft was already sent. Review the current draft before sending again.", 409, this.state(doc));
      if (!input.snapshot.text.trim() && input.snapshot.attachments.length === 0) throw new ComposerError("Write a message or attach audio before sending.", 400);
      if (!doc.pending) {
        // Validate managed references now, without retaining their temporary working paths in the request identity.
        for (const entry of input.snapshot.attachments) {
          try { await this.audio.verify(entry.id); }
          catch { throw new ComposerError(`${entry.name} is unavailable or changed. Remove it and attach the intended audio again.`, 400, this.state(doc)); }
        }
        doc.pending = { requestId: randomUUID(), payload: ComposerStore.payload(input.snapshot), snapshot: structuredClone(input.snapshot) };
        doc.revision++;
      }
      this.remember(doc, input.writeId, input);
      await song.file.write(doc);
      return this.state(doc);
    });
  }

  async resolve(input: ComposerResolve): Promise<ComposerState> {
    return this.withSong(input.songId, async (song) => {
      const doc = await this.load(song, input.songId);
      if (this.repeated(doc, input.writeId, input)) return this.state(doc);
      if (input.baseRevision !== doc.revision) throw new ComposerError("The saved draft changed. Review the saved choices again.", 409, this.state(doc));
      const conflict = doc.conflicts.find((item) => item.id === input.conflictId);
      if (!conflict) throw new ComposerError("That saved draft was already resolved.", 409, this.state(doc));
      const preserved = input.choice === "local" ? { ...conflict, draft: doc.draft, id: randomUUID(), writerId: doc.lastWriterId ?? input.writerId,
        baseRevision: doc.revision, createdAt: new Date().toISOString() } : conflict;
      await new JsonFile(join(song.dir, "composer-recovery", `${preserved.id}.json`), ComposerConflictSchema, () => preserved, { mode: 0o600 }).write(preserved);
      if (input.choice === "local") { doc.draft = this.removeAccepted(conflict.draft, doc); doc.lastWriterId = input.writerId; }
      doc.conflicts = doc.conflicts.filter((item) => item.id !== conflict.id);
      doc.revision++;
      this.remember(doc, input.writeId, input);
      await song.file.write(doc);
      return this.state(doc);
    });
  }

  async cancel(input: ComposerCancel): Promise<ComposerState> {
    return this.cancelMany(input.songId, [input.requestId]);
  }

  async cancelMany(songId: string, requestIds: readonly string[]): Promise<ComposerState> {
    return this.withSong(songId, async (song) => {
      // Cancellation deliberately does not clear the draft, even when words were accepted just before Stop.
      const doc = await song.file.read();
      let changed = false;
      for (const id of requestIds) if (!doc.cancelled.includes(id)) { doc.cancelled.push(id); changed = true; }
      if (doc.pending && requestIds.includes(doc.pending.requestId)) { doc.pending = null; changed = true; }
      if (changed) { doc.revision++; await song.file.write(doc); }
      return this.state(doc);
    });
  }

  async assertRequest(songId: string, requestId: string, payload: string): Promise<void> {
    return this.withSong(songId, async (song) => {
      const doc = await song.file.read();
      if (doc.cancelled.includes(requestId)) throw new ComposerError("That send was stopped. Send the current draft with a fresh request id.");
      if (doc.pending?.requestId === requestId && doc.pending.payload !== payload) throw new ComposerError("That request id belongs to different saved words. Review the draft before sending.");
    });
  }

  async accepted(songId: string, _requestId: string): Promise<ComposerState> { return this.read(songId); }

  /** Upload and draft linking share the per-song queue and entry id, so a lost upload ACK cannot create another selection. */
  async attach(input: { songId: string; writerId: string; entryId: string; baseRevision: number; snapshot: ComposerDraft; scope: ComposerAttachment["scope"]; audio: AudioFileInput }): Promise<ManagedAudio & { entryId: string; linked: boolean; scope: ComposerAttachment["scope"]; composer: ComposerState }> {
    return this.withSong(input.songId, async (song) => {
      const doc = await this.load(song, input.songId);
      const hash = digest({ name: input.audio.name, scope: input.scope, source: input.audio.source, range: input.audio.range, bytes: createHash("sha256").update(input.audio.bytes).digest("hex") });
      const previous = doc.uploads.find((item) => item.entryId === input.entryId);
      if (previous && previous.hash !== hash) throw new ComposerError("That attachment selection already belongs to different audio.", 409, this.state(doc));
      let attachment = previous?.attachment;
      if (!attachment) {
        const canAppend = input.baseRevision === doc.revision && same(input.snapshot, doc.draft) || doc.lastWriterId === input.writerId;
        const intended = canAppend ? doc.draft : this.removeAccepted(input.snapshot, doc);
        if (intended.attachments.length >= 16) throw new ComposerError("Keep at most 16 audio attachments in one message.", 400);
        const prospective = ComposerDraftSchema.safeParse({ ...intended, attachments: [...intended.attachments, { entryId: input.entryId,
          id: "00000000-0000-4000-8000-000000000000", scope: input.scope, name: basename(input.audio.name.replaceAll("\\", "/")) }] });
        if (!prospective.success) throw new ComposerError("This audio would make the saved draft too large. Shorten the message or remove an attachment first.", 400, this.state(doc));
        const record = await this.audio.add(input.audio);
        attachment = { entryId: input.entryId, id: record.id, scope: input.scope, name: record.name };
        doc.uploads.push({ entryId: input.entryId, hash, attachment });
        if (canAppend) { doc.draft.attachments.push(attachment); doc.lastWriterId = input.writerId; }
        else {
          const draft = { ...structuredClone(intended), attachments: [...intended.attachments.filter((entry) => entry.entryId !== attachment!.entryId), attachment] };
          doc.conflicts = [...doc.conflicts.filter((item) => item.writerId !== input.writerId), { id: randomUUID(), writerId: input.writerId,
            draft, baseRevision: input.baseRevision, createdAt: new Date().toISOString() }];
        }
        doc.revision++;
        await song.file.write(doc);
      }
      if (doc.conflicts.some((item) => item.draft.attachments.some((entry) => entry.entryId === input.entryId))) throw new ComposerError("This audio is saved with your other draft. Choose which draft to use before sending.", 409, this.state(doc));
      const linked = doc.draft.attachments.some((entry) => entry.entryId === input.entryId);
      return { ...await this.audio.open(attachment.id), entryId: attachment.entryId, linked, scope: attachment.scope, composer: this.state(doc) };
    });
  }

  private async load(song: SongFile, songId: string): Promise<Document> {
    const doc = await song.file.read();
    if (doc.songId !== songId) throw new ComposerError("The saved draft belongs to another song.", 400);
    if (doc.pending) {
      const exchange = await this.conversations.log(songId).find(doc.pending.requestId);
      if (exchange) {
        if (exchange.request !== doc.pending.payload) throw new ComposerError("The saved send id belongs to different conversation text.", 409, this.state(doc));
        const sent = doc.pending;
        if (doc.draft.textEditId === sent.snapshot.textEditId && doc.draft.text === sent.snapshot.text) { doc.draft.text = ""; doc.draft.textEditId = randomUUID(); }
        const entryIds = sent.snapshot.attachments.map((entry) => entry.entryId);
        doc.draft.attachments = doc.draft.attachments.filter((entry) => !entryIds.includes(entry.entryId));
        doc.accepted.push({ requestId: sent.requestId, textEditId: sent.snapshot.textEditId, textHash: digest(sent.snapshot.text), snapshotHash: digest(sent.snapshot), entryIds });
        doc.pending = null;
        doc.revision++;
      }
    }
    await song.file.write(doc);
    return doc;
  }

  private removeAccepted(draft: ComposerDraft, doc: Document): ComposerDraft {
    const textWasSent = this.textWasAccepted(draft, doc);
    const consumed = new Set(doc.accepted.flatMap((item) => item.entryIds));
    return { text: textWasSent ? "" : draft.text, textEditId: textWasSent ? (doc.draft.text === "" ? doc.draft.textEditId : randomUUID()) : draft.textEditId,
      attachments: draft.attachments.filter((entry) => !consumed.has(entry.entryId)) };
  }

  private textWasAccepted(draft: ComposerDraft, doc: Document): boolean {
    return doc.accepted.some((item) => item.textEditId === draft.textEditId && (!item.textHash || item.textHash === digest(draft.text)));
  }

  private state(doc: Document): ComposerState { return structuredClone({ songId: doc.songId, revision: doc.revision, draft: doc.draft, pending: doc.pending, conflicts: doc.conflicts }); }
  private repeated(doc: Document, id: string, input: unknown): boolean {
    const previous = doc.writes.find((item) => item.id === id);
    if (!previous) return false;
    if (previous.hash !== digest(input)) throw new ComposerError("That write id belongs to a different draft save.", 409, this.state(doc));
    if (previous.conflict) throw new ComposerError("This save is retained as a conflicting draft.", 409, this.state(doc));
    return true;
  }
  private remember(doc: Document, id: string, input: unknown, conflict = false): void {
    doc.writes = [...doc.writes, { id, hash: digest(input), conflict }].slice(-256);
    const write = input as Partial<ComposerWrite>;
    if (typeof write.sequence === "number" && write.writerId && write.draft) doc.writerHeads = [...doc.writerHeads.filter((item) => item.writerId !== write.writerId),
      { writerId: write.writerId, sequence: write.sequence, draftHash: digest(write.draft), conflict }];
  }
  private static payload(draft: ComposerDraft): string {
    const audio = draft.attachments.map((entry) => `Audio attachment (${entry.scope}): ${JSON.stringify(entry.name)}\nManaged audio ID: ${entry.id} (open with library_audio_open; temporary paths are not saved)`).join("\n\n");
    return [draft.text.trim(), audio].filter(Boolean).join("\n\n");
  }
  private async withSong<R>(songId: string, work: (song: SongFile) => Promise<R>): Promise<R> {
    const dir = await this.songs.directoryFor(songId);
    let song = this.files.get(dir);
    if (!song) {
      song = { dir, queue: Promise.resolve(), file: new JsonFile(join(dir, "composer.json"), DocumentSchema, () => ({ version: 1, songId, revision: 0,
        draft: { text: "", textEditId: randomUUID(), attachments: [] }, lastWriterId: null, pending: null, conflicts: [], writes: [], writerHeads: [], cancelled: [], accepted: [], uploads: [] }), { mode: 0o600 }) };
      this.files.set(dir, song);
    }
    const captured = song;
    const result = captured.queue.then(() => work(captured));
    captured.queue = result.catch(() => undefined);
    return result;
  }
}
