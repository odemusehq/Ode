import { DOMImplementation, DOMParser, XMLSerializer, type Element, type Document } from "@xmldom/xmldom";
import { LeadSheetSchema, type LeadSheet } from "../shared/song";
import { LyricsDocument, type VocalClip } from "../shared/lyrics-document";

const FIELD = "ode.song";
const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const NAMES = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const SHARP = new Set([1, 3, 6, 8, 10]);
const TYPES = new Map<number, [string, boolean]>([[0.125, ["32nd", false]], [0.25, ["16th", false]], [0.5, ["eighth", false]],
  [0.75, ["eighth", true]], [1, ["quarter", false]], [1.5, ["quarter", true]], [2, ["half", false]], [3, ["half", true]], [4, ["whole", false]]]);

function children(parent: Element, name: string): Element[] {
  return Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1 && node.nodeName === name);
}
function child(parent: Element, name: string): Element | undefined { return children(parent, name)[0]; }
function number(parent: Element, name: string): number {
  const text = child(parent, name)?.textContent;
  if (text === undefined || text === "" || !Number.isFinite(Number(text))) throw new Error(`Invalid MusicXML ${name}.`);
  return Number(text);
}
function add(doc: Document, parent: Element, name: string, text?: string | number): Element {
  const element = doc.createElement(name);
  if (text !== undefined) element.appendChild(doc.createTextNode(String(text)));
  parent.appendChild(element);
  return element;
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
      add(doc, listed, "part-name", clip?.id ?? "Voice");
      const part = add(doc, root, "part");
      part.setAttribute("id", partId);
      const measure = add(doc, part, "measure");
      measure.setAttribute("number", "1");
      measure.setAttribute("implicit", "yes");
      const attributes = add(doc, measure, "attributes");
      // Positive decimal divisions preserve the actual MIDI time without rounding a performance onto a grid.
      add(doc, attributes, "divisions", 1);
      add(doc, add(doc, attributes, "time"), "senza-misura");
      const clef = add(doc, attributes, "clef");
      add(doc, clef, "sign", "G"); add(doc, clef, "line", 2);
      if (clip) MusicXml.writeClip(doc, measure, clip, index, sheet);
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc) + "\n";
  }

  /** Reads Ode's document, taking actual pitches/times from its standard score, not a duplicate MIDI cache. */
  static read(xml: string): LeadSheet {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Ode's MusicXML document cannot contain external declarations.");
    const doc = new DOMParser({ onError: (level, message) => { throw new Error(`Invalid MusicXML: ${level}: ${message}`); } }).parseFromString(xml, "application/xml");
    const root = doc.documentElement;
    if (!root || root.nodeName !== "score-partwise") throw new Error("This is not a MusicXML partwise score.");
    const fields = Array.from(root.getElementsByTagName("miscellaneous-field")).filter(field => field.getAttribute("name") === FIELD);
    if (fields.length !== 1) throw new Error("This score is missing Ode's editable lyrics metadata; it was not opened as an Ode song.");
    const sheet = LeadSheetSchema.parse(JSON.parse(fields[0]!.textContent ?? ""));
    const title = child(child(root, "work") ?? root, "work-title");
    if (title) sheet.title = title.textContent ?? "";
    const clips = sheet.notation?.clips ?? [];
    clips.forEach((clip, index) => {
      const part = children(root, "part").find(part => part.getAttribute("id") === `P${index + 1}`);
      if (!part) throw new Error(`MusicXML is missing the vocal part ${clip.id}.`);
      const seen = new Set<number>();
      let divisions = 1, position = 0;
      for (const measure of children(part, "measure")) {
        const attrs = child(measure, "attributes");
        if (attrs && child(attrs, "divisions")) divisions = number(attrs, "divisions");
        if (divisions <= 0) throw new Error("Invalid MusicXML divisions.");
        for (const node of Array.from(measure.childNodes).filter((node): node is Element => node.nodeType === 1)) {
          if (node.nodeName === "forward") position += number(node, "duration") / divisions;
          if (node.nodeName === "backup") position -= number(node, "duration") / divisions;
          if (node.nodeName !== "note") continue;
          const id = node.getAttribute("id") ?? "";
          const match = new RegExp(`^v${index}n(\\d+)$`).exec(id);
          if (!match || child(node, "chord") || child(node, "grace") || child(node, "rest")) throw new Error("The vocal score's note identities or structure changed; its Live association needs explicit reconciliation.");
          const at = Number(match[1]), original = clip.notes[at];
          if (!original || seen.has(at)) throw new Error("The vocal score contains an unknown or duplicate note identity.");
          const pitch = child(node, "pitch");
          if (!pitch) throw new Error("The vocal score is missing a note pitch.");
          const step = child(pitch, "step")?.textContent ?? "";
          const stepIndex = STEPS.indexOf(step);
          if (stepIndex < 0) throw new Error("The vocal score contains an invalid pitch step.");
          const midi = 12 * (number(pitch, "octave") + 1) + SEMITONES[stepIndex]! + (child(pitch, "alter") ? number(pitch, "alter") : 0);
          const duration = number(node, "duration") / divisions;
          const exactStart = Math.abs(position - original.start) <= Number.EPSILON * Math.max(1, Math.abs(position)) * 8 ? original.start : position;
          clip.notes[at] = { ...original, pitch: midi, start: exactStart, duration };
          position += duration;
          seen.add(at);
        }
      }
      if (seen.size !== clip.notes.length) throw new Error("The vocal score lost notes; its Live association needs explicit reconciliation.");
    });
    return LeadSheetSchema.parse(sheet);
  }

  private static writeClip(doc: Document, measure: Element, clip: VocalClip, clipIndex: number, sheet: LeadSheet): void {
    const check = sheet.notation ? LyricsDocument.check(sheet.notation, sheet.lyrics) : undefined;
    const raw = sheet.lyrics.split("\n");
    const byLine = new Map<number, NonNullable<typeof check>["lines"][number]>();
    let sung = 0;
    raw.forEach((line, index) => {
      if (!line.trim() || /^\s*\[[^\]]*\]\s*$/.test(line)) return;
      const found = check?.lines[sung++];
      if (found) byLine.set(index + 1, found);
    });
    let position = 0;
    for (const { note, index } of clip.notes.map((note, index) => ({ note, index })).sort((a, b) => a.note.start - b.note.start || a.index - b.index)) {
      const delta = note.start - position;
      if (delta) add(doc, add(doc, measure, delta > 0 ? "forward" : "backup"), "duration", Math.abs(delta));
      const element = add(doc, measure, "note");
      element.setAttribute("id", `v${clipIndex}n${index}`);
      const pitch = add(doc, element, "pitch"), semitone = note.pitch % 12;
      add(doc, pitch, "step", NAMES[semitone]);
      if (SHARP.has(semitone)) add(doc, pitch, "alter", 1);
      add(doc, pitch, "octave", Math.floor(note.pitch / 12) - 1);
      add(doc, element, "duration", note.duration);
      const type = TYPES.get(note.duration);
      if (type) { add(doc, element, "type", type[0]); if (type[1]) add(doc, element, "dot"); }
      position = note.start + note.duration;
      const bound = clip.bindings.filter(binding => !binding.stale && raw[binding.line - 1] === binding.text && binding.notes.includes(index));
      const ipa: string[] = [];
      let lyric: Element | undefined;
      for (const binding of bound) {
        const word = byLine.get(binding.line)?.words[binding.word];
        const syllable = word?.syllables[binding.syllable];
        if (syllable === undefined || !word) continue;
        const first = binding.notes[0] === index;
        if (lyric) add(doc, lyric, "elision", " ");
        else lyric = add(doc, element, "lyric");
        if (first) {
          add(doc, lyric, "syllabic", word.syllables.length === 1 ? "single" : binding.syllable === 0 ? "begin" : binding.syllable === word.syllables.length - 1 ? "end" : "middle");
          add(doc, lyric, "text", syllable);
          if (word.ipa?.[binding.syllable]) ipa.push(word.ipa[binding.syllable]!);
        }
        if (binding.notes.length > 1) add(doc, lyric, "extend").setAttribute("type", first ? "start" : binding.notes.at(-1) === index ? "stop" : "continue");
      }
      if (ipa.length) add(doc, add(doc, element, "play"), "ipa", ipa.join(""));
    }
  }
}
