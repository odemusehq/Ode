import { BEAT_TOLERANCE, type ClipRef, type LiveConnections, type Note } from "../shared/live";
import type { SelectionInfo } from "../shared/live-ops";
import type { SetSnapshot, TrackSnapshot } from "../shared/set-snapshot";
import type { Suggestion } from "../shared/events";
import type { LeadSheet } from "../shared/song";
import { NOTE_NAMES, noteName } from "../shared/notes";
import { TrackRole, roleFromName } from "../music/audio/track-role";
import { LyricsText } from "../mneme/lyrics-text";
import type { PreferencesStore } from "../mneme/preferences";
import type { SongStore } from "../mneme/song-store";
import { SetLookup, type FoundClip } from "./set-lookup";

/** What a selected part plays, which decides the actions that make sense for it. */
enum Part {
  Drums = "drums",
  Bass = "bass",
  Vocal = "vocal",
  Chords = "chords",
  Other = "other",
}

/** A one-tap action: the chip's words and the plain sentence Ode is asked. */
interface Action {
  label: string;
  request: string;
}

/** A pitch class set to check notes against, with the key's name. */
interface Scale {
  pitchClasses: ReadonlySet<number>;
  label: string;
}

const PITCH_CLASSES = 12;
/** Three notes starting together make a chord (a triad). */
const CHORD_NOTES = 3;
const DRUM_RACK_CLASS = "DrumRackDevice";
const DRUM_NAMES = /\b(drums?|beats?|perc(ussion)?|kit|hats?|hi-?hats?|snares?|claps?|toms?|cymbals?|breaks?)\b/i;
const MELODY_NAMES = /\b(melody|topline|hook)\b/i;
const CHORD_NAMES = /\b(chords?|keys|piano|pads?|rhodes|organ|strings)\b/i;
const CHORUS_NAME = /chorus/i;

/** One-tap actions for what the musician has selected, up to `count`; fixes for problems the quick checks find come first. */
export class SuggestionFinder {
  constructor(
    private readonly live: LiveConnections,
    private readonly song: SongStore,
    private readonly prefs: PreferencesStore,
    private readonly count: number,
  ) {}

  async for(selection: SelectionInfo, snapshot: SetSnapshot): Promise<Suggestion[]> {
    const lookup = new SetLookup(snapshot);
    if (lookup.isEmpty) return this.chips([], SuggestionFinder.emptySet());
    const found = selection.clip ? lookup.clip(selection.clip) : undefined;
    if (selection.clip && found) return this.forClip(selection.clip, found, lookup);
    const track = selection.track ? lookup.track(selection.track) : undefined;
    if (track && track !== snapshot.main) return this.chips([], SuggestionFinder.forTrack(track));
    return this.chips([], await this.forSong(lookup));
  }

  private async forClip(ref: ClipRef, found: FoundClip, lookup: SetLookup): Promise<Suggestion[]> {
    const where = SuggestionFinder.clipPlace(found, lookup);
    if (found.clip.kind === "audio") return this.chips([], SuggestionFinder.forAudioClip(found.track, where));
    const notes = await this.notesOf(ref, found);
    const part = SuggestionFinder.partOf(found.track, notes);
    const fixes = [...SuggestionFinder.keyFixes(part, notes, where, lookup.snapshot), ...(await this.rangeFixes(part, notes, where))];
    return this.chips(fixes, SuggestionFinder.forMidiClip(part, where));
  }

  /** The clip's notes as they are now; the snapshot's when Live can't be asked. */
  private async notesOf(ref: ClipRef, found: FoundClip): Promise<Note[]> {
    try {
      return (await this.live.extension.call<{ notes: Note[] }>("midi_clip_get_notes", { clip: ref })).notes;
    } catch {
      return found.clip.notes ?? [];
    }
  }

  /** Notes outside the song's scale (never on drums, where notes pick sounds rather than pitches). */
  private static keyFixes(part: Part, notes: Note[], where: string, snapshot: SetSnapshot): Action[] {
    if (part === Part.Drums) return [];
    const scale = SuggestionFinder.scale(snapshot);
    if (!scale) return [];
    const outside = notes.filter((note) => !note.muted && !scale.pitchClasses.has(((note.pitch % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES));
    if (outside.length === 0) return [];
    const count = SuggestionFinder.notes(outside.length);
    return [
      {
        label: `${count} out of key · Fix`,
        request: `Fix the ${outside.length} out-of-key ${outside.length === 1 ? "note" : "notes"} in ${where}: move ${outside.length === 1 ? "it" : "them"} into ${scale.label}.`,
      },
    ];
  }

  /** Melody notes outside the musician's vocal range, when it is known. */
  private async rangeFixes(part: Part, notes: Note[], where: string): Promise<Action[]> {
    if (part !== Part.Vocal) return [];
    const range = (await this.prefs.effective(await this.song.read())).vocalRange;
    if (!range) return [];
    const outside = notes.filter((note) => !note.muted && (note.pitch < range.low || note.pitch > range.high));
    if (outside.length === 0) return [];
    return [
      {
        label: `${SuggestionFinder.notes(outside.length)} out of your range · Fix`,
        request: `Bring the ${SuggestionFinder.notes(outside.length)} in ${where} that fall outside the vocal range (${noteName(range.low)}–${noteName(range.high)}) back into range.`,
      },
    ];
  }

  /** Live's scale when Scale Mode is on, so it follows the key the musician set in Live; none when it is off. */
  private static scale(snapshot: SetSnapshot): Scale | null {
    const { song } = snapshot;
    if (!song.scaleMode || song.scaleIntervals.length === 0) return null;
    return {
      pitchClasses: new Set(song.scaleIntervals.map((interval) => (song.rootNote + interval) % PITCH_CLASSES)),
      label: `${NOTE_NAMES[song.rootNote]} ${song.scaleName}`,
    };
  }

  private async forSong(lookup: SetLookup): Promise<Action[]> {
    const sheet = await this.song.read();
    const actions: Action[] = [
      { label: "Check the mix", request: "Check the mix and fix the biggest problems." },
      { label: "Master for streaming", request: "Master the song for streaming." },
    ];
    if (sheet.sections.length === 0 && lookup.snapshot.song.locators.length === 0) {
      actions.push({ label: "Plan the sections", request: "Plan the song form and mark each section with a locator." });
    }
    if (SuggestionFinder.hasChorus(sheet, lookup.snapshot)) actions.push({ label: "Bigger chorus", request: "Make the chorus bigger." });
    if (LyricsText.sung(sheet.lyrics).length === 0) actions.push({ label: "Write lyrics", request: "Write lyrics for the song." });
    if (!sheet.title) actions.push({ label: "Find a title", request: "Find a title for the song." });
    actions.push(
      { label: "Arrange the song", request: "Arrange the song from the parts in the Set." },
      { label: "Add a new part", request: "Add the part the song is missing most." },
    );
    return actions;
  }

  private static forMidiClip(part: Part, where: string): Action[] {
    switch (part) {
      case Part.Bass:
        return [
          { label: "Lock to the kick", request: `Make the bassline in ${where} lock to the kick.` },
          { label: "Follow the chords", request: `Make the bassline in ${where} follow the chords.` },
          { label: "More movement", request: `Give the bassline in ${where} more movement.` },
          { label: "Simpler", request: `Make the bassline in ${where} simpler.` },
        ];
      case Part.Drums:
        return [
          { label: "Add a fill", request: `Add a drum fill at the end of ${where}.` },
          { label: "More groove", request: `Give the drums in ${where} more groove.` },
          { label: "Busier hats", request: `Make the hi-hats in ${where} busier.` },
          { label: "Half-time feel", request: `Turn the beat in ${where} into a half-time feel.` },
          { label: "Simpler", request: `Make the beat in ${where} simpler.` },
        ];
      case Part.Vocal:
        return [
          { label: "Set the lyrics", request: `Set the lyrics to the melody in ${where}.` },
          { label: "Catchier", request: `Make the melody in ${where} catchier.` },
          { label: "Add a harmony", request: `Add a harmony line to the melody in ${where}.` },
          { label: "Easier to sing", request: `Make the melody in ${where} easier to sing.` },
          { label: "Vary it", request: `Vary the melody in ${where} so it doesn't repeat exactly.` },
        ];
      case Part.Chords:
        return [
          { label: "Richer voicings", request: `Give the chords in ${where} richer voicings.` },
          { label: "Reharmonize", request: `Reharmonize the chords in ${where}.` },
          { label: "Smoother voice leading", request: `Revoice the chords in ${where} for smoother voice leading.` },
          { label: "Add rhythm", request: `Give the chords in ${where} a rhythm instead of held notes.` },
          { label: "Bassline for these", request: `Write a bassline that follows the chords in ${where}.` },
        ];
      case Part.Other:
        return [
          { label: "Vary it", request: `Vary the part in ${where}.` },
          { label: "More movement", request: `Give the part in ${where} more movement.` },
          { label: "Simpler", request: `Make the part in ${where} simpler.` },
          { label: "Counter-melody", request: `Write a counter-melody to the part in ${where}.` },
        ];
    }
  }

  private static forAudioClip(track: TrackSnapshot, where: string): Action[] {
    if (roleFromName(track.name) === TrackRole.Vocal) {
      return [
        { label: "Words to lyrics", request: `Transcribe the words sung in ${where} into the lyrics.` },
        { label: "Melody to MIDI", request: `Turn the sung melody in ${where} into MIDI.` },
        { label: "Sit it in the mix", request: `Make the vocal on ${track.name} sit well in the mix.` },
        { label: "Clean up the low end", request: `Clean up the low end of the vocal on ${track.name}.` },
      ];
    }
    return [
      { label: "What's in it?", request: `Describe what's in the recording in ${where}.` },
      { label: "Make a sample", request: `Make a sample from the recording in ${where}.` },
      { label: "Sit it in the mix", request: `Make ${track.name} sit well in the mix.` },
      { label: "Clean up the low end", request: `Clean up the low end of ${track.name}.` },
    ];
  }

  private static forTrack(track: TrackSnapshot): Action[] {
    const name = track.name;
    const mix: Action[] = [
      { label: "Sit it in the mix", request: `Make ${name} sit well in the mix.` },
      { label: "Shape the sound", request: `Shape the sound of ${name}.` },
    ];
    if (track.kind === "return") {
      return [
        { label: "Shape the effect", request: `Shape the effect on the ${name} return track.` },
        { label: "Set the sends", request: `Set how much of each track goes to the ${name} return track.` },
        { label: "Check the mix", request: "Check the mix and fix the biggest problems." },
        { label: "Clean up the low end", request: `Clean up the low end of the ${name} return track.` },
      ];
    }
    if (track.kind === "group") {
      return [
        ...mix,
        { label: "Glue the group", request: `Glue the tracks in the ${name} group together.` },
        { label: "Check the mix", request: "Check the mix and fix the biggest problems." },
      ];
    }
    if (track.kind === "audio") {
      return [
        ...mix,
        { label: "Add space", request: `Give ${name} some space with reverb or delay.` },
        { label: "Clean up the low end", request: `Clean up the low end of ${name}.` },
      ];
    }
    switch (SuggestionFinder.partOf(track, [])) {
      case Part.Drums:
        return [{ label: "Start a beat", request: `Write a drum beat on ${name}.` }, { label: "Add a fill", request: `Add a drum fill on ${name} before the next section.` }, ...mix];
      case Part.Bass:
        return [{ label: "Write a bassline", request: `Write a bassline on ${name} that follows the chords and locks with the kick.` }, ...mix, { label: "More low end", request: `Give ${name} more low end without muddying the mix.` }];
      case Part.Vocal:
        return [{ label: "Write a melody", request: `Write a melody on ${name}.` }, { label: "Hum an idea", request: `Get ${name} ready so I can hum an idea, then turn what I hum into MIDI.` }, ...mix];
      default:
        return [{ label: "Chord loop", request: `Write a chord loop on ${name}.` }, { label: "Write a part", request: `Write a part on ${name} that fits the song.` }, ...mix];
    }
  }

  private static emptySet(): Action[] {
    return [
      { label: "Start a beat", request: "Start a drum beat." },
      { label: "Chord loop", request: "Write a chord loop to start the song." },
      { label: "Hum an idea", request: "Get a track ready so I can hum an idea, then turn what I hum into MIDI." },
      { label: "Find a title", request: "Find a title for the song." },
    ];
  }

  /** What a track's notes most likely play, from its name, its devices and (for a clip) its notes. */
  private static partOf(track: TrackSnapshot, notes: Note[]): Part {
    const role = roleFromName(track.name);
    if (role === TrackRole.Kick || DRUM_NAMES.test(track.name) || track.devices.some((device) => device.className === DRUM_RACK_CLASS)) {
      return Part.Drums;
    }
    if (role === TrackRole.Bass) return Part.Bass;
    if (role === TrackRole.Vocal || MELODY_NAMES.test(track.name)) return Part.Vocal;
    if (CHORD_NAMES.test(track.name) || SuggestionFinder.mostlyChords(notes)) return Part.Chords;
    return Part.Other;
  }

  /** True when most of the clip's onsets start three or more notes together. */
  private static mostlyChords(notes: Note[]): boolean {
    const onsets = new Map<number, number>();
    for (const note of notes) {
      const at = Math.round(note.start / BEAT_TOLERANCE);
      onsets.set(at, (onsets.get(at) ?? 0) + 1);
    }
    if (onsets.size === 0) return false;
    const chords = [...onsets.values()].filter((count) => count >= CHORD_NOTES).length;
    return chords * 2 >= onsets.size;
  }

  private static hasChorus(sheet: LeadSheet, snapshot: SetSnapshot): boolean {
    return sheet.sections.some((section) => section.kind === "chorus") || snapshot.song.locators.some((locator) => CHORUS_NAME.test(locator.name));
  }

  /** 'clip "Bass A" on Bass', or 'the clip at bars 9–16 on Bass' when the clip has no name. */
  private static clipPlace({ track, clip, arranged }: FoundClip, lookup: SetLookup): string {
    if (clip.name) return `clip "${clip.name}" on ${track.name}`;
    return arranged ? `the clip at ${lookup.barsLabel(clip.startTime, clip.endTime)} on ${track.name}` : `the selected clip on ${track.name}`;
  }

  private static notes(count: number): string {
    return `${count} ${count === 1 ? "note" : "notes"}`;
  }

  /** Fixes first, then actions, up to `count` in all. */
  private chips(fixes: Action[], actions: Action[]): Suggestion[] {
    const seen = new Set<string>();
    return [...fixes.map((action) => ({ ...action, fix: true })), ...actions.map((action) => ({ ...action, fix: false }))]
      .slice(0, this.count)
      .map((action) => {
        let id = action.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        while (seen.has(id)) id = `${id}-more`;
        seen.add(id);
        return { id, label: action.label, request: action.request, fix: action.fix };
      });
  }
}
