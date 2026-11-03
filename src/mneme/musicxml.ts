import { t } from "../shared/i18n";
import { DOMImplementation, DOMParser, XMLSerializer, type Element, type Document } from "@xmldom/xmldom";
import { LeadSheetSchema, type LeadSheet } from "../shared/song";
import { LyricsDocument, ScoreMeterSchema, type ScoreMeter, type ScoreMeasure, type VocalClip } from "../shared/lyrics-document";

const FIELD = "ode.song";
const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const NAMES = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const SHARP = new Set([1, 3, 6, 8, 10]);
const TYPES = new Map<number, [string, boolean]>([[0.125, ["32nd", false]], [0.25, ["16th", false]], [0.5, ["eighth", false]],
  [0.75, ["eighth", true]], [1, ["quarter", false]], [1.5, ["quarter", true]], [2, ["half", false]], [3, ["half", true]], [4, ["whole", false]]]);

const TRIPLETS = new Map<number, string>([[4 / 3, "half"], [2 / 3, "quarter"], [1 / 3, "eighth"], [1 / 6, "16th"], [1 / 12, "32nd"]]);

function children(parent: Element, name: string): Element[] {
  return Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1 && node.nodeName === name);
}
function child(parent: Element, name: string): Element | undefined { return children(parent, name)[0]; }
function number(parent: Element, name: string): number {
  const text = child(parent, name)?.textContent;
  if (text === undefined || text === "" || !Number.isFinite(Number(text))) throw new Error(t("lyrics.document.xmlNumber", { name }));
  return Number(text);
}
function add(doc: Document, parent: Element, name: string, text?: string | number): Element {
  const element = doc.createElement(name);
  if (text !== undefined) element.appendChild(doc.createTextNode(typeof text === "number" ? decimal(text) : text));
  parent.appendChild(element);
  return element;
}

/** XML Schema decimals do not allow JavaScript's exponent notation, including tiny timing offsets. */
function decimal(value: number): string {
  const [mantissa, exponent] = String(value).split("e");
  if (exponent === undefined) return mantissa!;
  const negative = mantissa!.startsWith("-"), unsigned = negative ? mantissa!.slice(1) : mantissa!;
  const digits = unsigned.replace(".", ""), point = (unsigned.split(".")[0]?.length ?? 0) + Number(exponent);
  const expanded = point <= 0 ? "0." + "0".repeat(-point) + digits : point >= digits.length ? digits + "0".repeat(point - digits.length) : digits.slice(0, point) + "." + digits.slice(point);
  return (negative ? "-" : "") + expanded;
}

/** Standard MusicXML musical values, with one named Ode metadata field for draft text and editing relationships. */
export class MusicXml {
  static write(value: LeadSheet): string {
    const sheet = LeadSheetSchema.parse(value);
    const doc = new DOMImplementation().createDocument(null, "score-partwise", null);
    const root = doc.documentElement!;
    root.setAttribute("version", "4.0");
    add(doc, add(doc, root, "work"), "work-title", sheet.title);
    const metadata = add(doc, add(doc, add(doc, root, "identification"), "miscellaneous"), "miscellaneous-field", JSON.stringify(sheet));
    metadata.setAttribute("name", FIELD);
    const list = add(doc, root, "part-list");
    const clips = sheet.notation?.clips ?? [];
    const parts = clips.length ? clips : [undefined];
    parts.forEach((clip, index) => {
      const partId = `P${index + 1}`;
      const listed = add(doc, list, "score-part");
      listed.setAttribute("id", partId);
      add(doc, listed, "part-name", clip?.id ?? t("lyrics.document.voicePart"));
      const part = add(doc, root, "part");
      part.setAttribute("id", partId);
      const measures = clip ? MusicXml.measures(clip) : [{ number: "1", start: 0, length: 0 }];
      let previous: ScoreMeter | undefined;
      measures.forEach((layout, at) => {
        const measure = add(doc, part, "measure");
        measure.setAttribute("number", layout.number);
        if (layout.implicit || !layout.meter) measure.setAttribute("implicit", "yes");
        const attributes = add(doc, measure, "attributes");
        add(doc, attributes, "divisions", 1);
        if (at === 0 || JSON.stringify(layout.meter) !== JSON.stringify(previous)) {
          const time = add(doc, attributes, "time");
          if (layout.meter) { add(doc, time, "beats", layout.meter.beats); add(doc, time, "beat-type", layout.meter.beatType); }
          else add(doc, time, "senza-misura");
        }
        previous = layout.meter;
        if (at === 0) {
          const clef = add(doc, attributes, "clef");
          add(doc, clef, "sign", "G"); add(doc, clef, "line", 2);
        }
        if (clip) MusicXml.writeClip(doc, measure, clip, index, sheet, layout, measures);
      });
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc) + "\n";
  }

  /** Reads Ode's document, taking actual pitches/times from its standard score, not a duplicate MIDI cache. */
  static read(xml: string): LeadSheet {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error(t("lyrics.document.xmlDeclarations"));
    const doc = new DOMParser({ onError: (level, message) => { throw new Error(t("lyrics.document.xmlMalformed", { level, message })); } }).parseFromString(xml, "application/xml");
    const root = doc.documentElement;
    if (!root || root.nodeName !== "score-partwise") throw new Error(t("lyrics.document.xmlPartwise"));
    const fields = Array.from(root.getElementsByTagName("miscellaneous-field")).filter(field => field.getAttribute("name") === FIELD);
    if (fields.length !== 1) throw new Error(t("lyrics.document.xmlMetadata"));
    const sheet = LeadSheetSchema.parse(JSON.parse(fields[0]!.textContent ?? ""));
    const title = child(child(root, "work") ?? root, "work-title");
    if (title) sheet.title = title.textContent ?? "";
    const clips = sheet.notation?.clips ?? [];
    if (children(root, "part").length !== Math.max(1, clips.length)) throw new Error(t("lyrics.document.scoreStructure"));
    if (!clips.length && root.getElementsByTagName("note").length) throw new Error(t("lyrics.document.scoreStructure"));
    clips.forEach((clip, index) => MusicXml.readClip(root, clip, index));
    // Compare the underlay against the same parsed measures and notes, so rebarring does not reuse a stale layout.
    const expected = new DOMParser().parseFromString(MusicXml.write(sheet), "application/xml");
    const underlay = (note: Element): string => JSON.stringify([
      children(note, "lyric").map(lyric => [lyric.getAttribute("number"), Array.from(lyric.childNodes).filter((node): node is Element => node.nodeType === 1).map(node => [node.nodeName, node.getAttribute("type"), node.textContent])]),
      children(note, "play").flatMap(play => children(play, "ipa").map(ipa => ipa.textContent)),
    ]);
    const expectedNotes = new Map(Array.from(expected.getElementsByTagName("note")).map(note => [note.getAttribute("id"), underlay(note)]));
    for (const note of Array.from(root.getElementsByTagName("note"))) {
      if (underlay(note) !== expectedNotes.get(note.getAttribute("id"))) throw new Error(t("lyrics.document.scoreUnderlay"));
    }
    return LeadSheetSchema.parse(sheet);
  }

  /** Start from native MusicXML measure data; only extend a known, numbered metre when notes grow. */
  private static measures(clip: VocalClip): ScoreMeasure[] {
    const end = Math.max(0, ...clip.notes.map(note => note.start + note.duration));
    if (!clip.measures) return [{ number: "1", start: 0, length: end }];
    const measures = structuredClone(clip.measures);
    let position = 0;
    for (const measure of measures) {
      if (!MusicXml.close(measure.start, position) || measure.meter && !measure.implicit && !MusicXml.close(measure.length, LyricsDocument.measureLength(measure.meter))) throw new Error(t("lyrics.document.scoreMeasures"));
      position += measure.length;
    }
    while (end > position && !MusicXml.close(end, position)) {
      const last = measures.at(-1)!;
      if (!last.meter || !/^\d+$/.test(last.number)) throw new Error(t("lyrics.document.scoreMoreMeasures"));
      if (measures.length >= 10000) throw new Error(t("lyrics.document.scoreTooLong"));
      const length = LyricsDocument.measureLength(last.meter);
      measures.push({ number: String(Number(last.number) + 1), start: position, length, meter: last.meter });
      position += length;
    }
    return measures;
  }

  private static readClip(root: Element, clip: VocalClip, index: number): void {
    const part = children(root, "part").find(part => part.getAttribute("id") === `P${index + 1}`);
    if (!part) throw new Error(t("lyrics.document.xmlPartMissing", { id: clip.id }));
    const fragments = new Map<number, { segment: number; start: number; duration: number; pitch: number; ties: string[] }[]>();
    const measures: ScoreMeasure[] = [];
    let divisions = 1, start = 0, meter: ScoreMeter | undefined;
    for (const measure of children(part, "measure")) {
      let cursor = 0, extent = 0;
      const implicit = measure.getAttribute("implicit") === "yes";
      const attrs = child(measure, "attributes");
      if (attrs && child(attrs, "divisions")) divisions = number(attrs, "divisions");
      if (divisions <= 0) throw new Error(t("lyrics.document.xmlDivisions"));
      const time = attrs && child(attrs, "time");
      if (time) {
        const beats = children(time, "beats"), units = children(time, "beat-type");
        if (child(time, "senza-misura")) meter = undefined;
        else {
          if (beats.length !== 1 || units.length !== 1) throw new Error(t("lyrics.document.scoreTime"));
          meter = ScoreMeterSchema.parse({ beats: beats[0]!.textContent, beatType: number(time, "beat-type") });
        }
      }
      for (const node of Array.from(measure.childNodes).filter((node): node is Element => node.nodeType === 1)) {
        if (node.nodeName === "attributes" && (child(node, "time") || child(node, "divisions")) && (node !== attrs || cursor !== 0)) throw new Error(t("lyrics.document.scoreMidBarTime"));
        if (node.nodeName === "forward" || node.nodeName === "backup") {
          const duration = number(node, "duration") / divisions;
          if (duration <= 0) throw new Error(t("lyrics.document.scoreTiming"));
          cursor += node.nodeName === "forward" ? duration : -duration;
          if (cursor < 0 && !MusicXml.close(cursor, 0)) throw new Error(t("lyrics.document.scoreTiming"));
          extent = Math.max(extent, cursor);
        }
        if (node.nodeName !== "note") continue;
        const match = new RegExp(`^v${index}n(\\d+)(?:s([1-9]\\d*))?$`).exec(node.getAttribute("id") ?? "");
        if (!match || child(node, "chord") || child(node, "grace") || child(node, "rest")) throw new Error(t("lyrics.document.xmlIdentity"));
        const at = Number(match[1]), segment = Number(match[2] ?? 0);
        if (!clip.notes[at]) throw new Error(t("lyrics.document.xmlDuplicate"));
        const pitch = child(node, "pitch");
        if (!pitch) throw new Error(t("lyrics.document.xmlPitchMissing"));
        const stepIndex = STEPS.indexOf(child(pitch, "step")?.textContent ?? "");
        if (stepIndex < 0) throw new Error(t("lyrics.document.xmlPitchInvalid"));
        const midi = 12 * (number(pitch, "octave") + 1) + SEMITONES[stepIndex]! + (child(pitch, "alter") ? number(pitch, "alter") : 0);
        const duration = number(node, "duration") / divisions;
        if (duration <= 0) throw new Error(t("lyrics.document.scoreTiming"));
        const list = fragments.get(at) ?? [];
        if (list.some(fragment => fragment.segment === segment)) throw new Error(t("lyrics.document.xmlDuplicate"));
        list.push({ segment, start: start + cursor, duration, pitch: midi, ties: children(node, "tie").map(tie => tie.getAttribute("type") ?? "") });
        fragments.set(at, list);
        cursor += duration; extent = Math.max(extent, cursor);
      }
      const nominal = meter ? LyricsDocument.measureLength(meter) : extent;
      const length = implicit ? extent || nominal : nominal;
      if (meter && !implicit && extent > nominal && !MusicXml.close(extent, nominal)) throw new Error(t("lyrics.document.scoreTiming"));
      if (length > 0) measures.push({ number: measure.getAttribute("number") ?? String(measures.length + 1), start, length, ...(meter ? { meter } : {}), ...(implicit && meter ? { implicit: true } : {}) });
      start += length;
    }
    if (fragments.size !== clip.notes.length) throw new Error(t("lyrics.document.xmlNotesMissing"));
    clip.notes = clip.notes.map((original, at) => {
      const parts = fragments.get(at)!.sort((a, b) => a.segment - b.segment);
      let end = parts[0]!.start;
      parts.forEach((fragment, index) => {
        const expected = [...(index > 0 ? ["stop"] : []), ...(index < parts.length - 1 ? ["start"] : [])];
        if (fragment.segment !== index || fragment.pitch !== parts[0]!.pitch || !MusicXml.close(fragment.start, end) || JSON.stringify([...fragment.ties].sort()) !== JSON.stringify(expected.sort())) throw new Error(t("lyrics.document.scoreTies"));
        end = fragment.start + fragment.duration;
      });
      const first = parts[0]!, duration = parts.reduce((sum, part) => sum + part.duration, 0);
      return { ...original, pitch: first.pitch, start: MusicXml.close(first.start, original.start) ? original.start : first.start,
        duration: Math.abs(duration - original.duration) <= Number.EPSILON * Math.max(1, first.start, original.start, duration, original.duration) * 16 ? original.duration : duration };
    });
    if (measures.some(measure => measure.meter) || clip.measures || measures.length > 1) clip.measures = measures;
  }

  private static close(a: number, b: number): boolean { return Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 16; }

  private static writeClip(doc: Document, measure: Element, clip: VocalClip, clipIndex: number, sheet: LeadSheet, layout: ScoreMeasure, measures: ScoreMeasure[]): void {
    const check = sheet.notation ? LyricsDocument.check(sheet.notation, sheet.lyrics) : undefined;
    const raw = sheet.lyrics.split("\n");
    const byLine = new Map<number, NonNullable<typeof check>["lines"][number]>();
    let sung = 0;
    raw.forEach((line, index) => {
      if (!line.trim() || /^\s*\[[^\]]*\]\s*$/.test(line)) return;
      const found = check?.lines[sung++];
      if (found) byLine.set(index + 1, found);
    });
    let position = layout.start;
    const boundary = layout.start + layout.length;
    for (const { note, index } of clip.notes.map((note, index) => ({ note, index })).sort((a, b) => a.note.start - b.note.start || a.index - b.index)) {
      const noteEnd = note.start + note.duration;
      if (note.start >= boundary || noteEnd <= layout.start || MusicXml.close(noteEnd, layout.start)) continue;
      const first = note.start >= layout.start, last = noteEnd <= boundary || MusicXml.close(noteEnd, boundary);
      const start = Math.max(note.start, layout.start), end = last ? noteEnd : boundary;
      const segment = measures.filter(other => other.start < layout.start && other.start + other.length > note.start).length;
      const delta = start - position;
      if (delta) add(doc, add(doc, measure, delta > 0 ? "forward" : "backup"), "duration", Math.abs(delta));
      const element = add(doc, measure, "note");
      element.setAttribute("id", `v${clipIndex}n${index}${segment ? "s" + segment : ""}`);
      const pitch = add(doc, element, "pitch"), semitone = note.pitch % 12;
      add(doc, pitch, "step", NAMES[semitone]);
      if (SHARP.has(semitone)) add(doc, pitch, "alter", 1);
      add(doc, pitch, "octave", Math.floor(note.pitch / 12) - 1);
      const duration = first && last ? note.duration : end - start;
      add(doc, element, "duration", duration);
      if (!first) add(doc, element, "tie").setAttribute("type", "stop");
      if (!last) add(doc, element, "tie").setAttribute("type", "start");
      const type = TYPES.get(duration);
      if (type) { add(doc, element, "type", type[0]); if (type[1]) add(doc, element, "dot"); }
      else {
        const triplet = [...TRIPLETS].find(([beats]) => Math.abs(beats - duration) <= 1e-9)?.[1];
        if (triplet) {
          add(doc, element, "type", triplet);
          const ratio = add(doc, element, "time-modification");
          add(doc, ratio, "actual-notes", 3); add(doc, ratio, "normal-notes", 2); add(doc, ratio, "normal-type", triplet);
        }
      }
      if (!first || !last) {
        const notations = add(doc, element, "notations");
        if (!first) add(doc, notations, "tied").setAttribute("type", "stop");
        if (!last) add(doc, notations, "tied").setAttribute("type", "start");
      }
      position = end;
      const bound = clip.bindings.filter(binding => !binding.stale && raw[binding.line - 1] === binding.text && binding.notes.includes(index));
      const ipa: string[] = [];
      for (const line of new Set(bound.map(binding => binding.line))) {
        const group = bound.filter(binding => binding.line === line).sort((a, b) => a.word - b.word || a.syllable - b.syllable);
        const valid = group.filter(binding => byLine.get(line)?.words[binding.word]?.syllables[binding.syllable] !== undefined);
        if (!valid.length) continue;
        const lyric = add(doc, element, "lyric");
        lyric.setAttribute("number", String(line));
        const starts = valid.filter(binding => binding.notes[0] === index && first);
        starts.forEach((binding, at) => {
          const word = byLine.get(line)!.words[binding.word]!;
          if (at) add(doc, lyric, "elision", " ");
          add(doc, lyric, "syllabic", word.syllables.length === 1 ? "single" : binding.syllable === 0 ? "begin" : binding.syllable === word.syllables.length - 1 ? "end" : "middle");
          add(doc, lyric, "text", word.syllables[binding.syllable]!);
          if (word.ipa?.[binding.syllable]) ipa.push(word.ipa[binding.syllable]!);
        });
        const extending = starts.length ? starts.at(-1)! : valid.at(-1)!;
        if (extending.notes.length > 1 || !first || !last) add(doc, lyric, "extend").setAttribute("type", extending.notes[0] === index && first ? "start" : extending.notes.at(-1) === index && last ? "stop" : "continue");
      }
      if (ipa.length) add(doc, add(doc, element, "play"), "ipa", ipa.join(""));
    }
    if (clip.measures && position < boundary && !MusicXml.close(position, boundary)) add(doc, add(doc, measure, "forward"), "duration", boundary - position);
  }
}
