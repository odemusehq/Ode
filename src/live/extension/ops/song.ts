import type { Track } from "@ableton-extensions/sdk";
import type { CreatedTrack } from "../../../shared/live-ops";
import { LiveError } from "../errors";
import type { Version } from "../sdk";
import { NewName, TaggedName } from "../tags";
import { OperationGroup } from "./group";
import { type FollowUps, type OpArgs, type OpRun, type OperationTable } from "./operation";

type SongOp =
  | "song_get"
  | "song_set_tempo"
  | "song_create_midi_track"
  | "song_create_audio_track"
  | "song_delete_track"
  | "song_duplicate_track"
  | "song_create_scene"
  | "song_delete_scene"
  | "song_duplicate_scene"
  | "song_create_locator"
  | "song_delete_locator"
  | "locator_rename";

/** Live's tempo range, in BPM. */
const TEMPO = { min: 20, max: 999 } as const;

/** The scene index that puts a new scene after the last one. */
const AFTER_LAST_SCENE = -1;

enum TrackType {
  Midi = "MIDI",
  Audio = "audio",
}

/** The Set as a whole: tempo, tracks, scenes and locators. */
export class SongOperations extends OperationGroup<SongOp> {
  table(): OperationTable<SongOp> {
    return {
      song_get: { prepare: () => this.get() },
      song_set_tempo: { prepare: (args) => this.setTempo(args) },
      song_create_midi_track: {
        prepare: (args, followUps) => this.createTrack(TrackType.Midi, args, followUps),
      },
      song_create_audio_track: {
        prepare: (args, followUps) => this.createTrack(TrackType.Audio, args, followUps),
      },
      song_delete_track: { prepare: (args) => this.deleteTrack(args) },
      song_duplicate_track: { prepare: (args, followUps) => this.duplicateTrack(args, followUps) },
      song_create_scene: { prepare: (args, followUps) => this.createScene(args, followUps) },
      song_delete_scene: { prepare: (args) => this.deleteScene(args) },
      song_duplicate_scene: { prepare: (args) => this.duplicateScene(args) },
      song_create_locator: { prepare: (args, followUps) => this.createLocator(args, followUps) },
      song_delete_locator: { prepare: (args) => this.deleteLocator(args) },
      locator_rename: { prepare: (args) => this.renameLocator(args) },
    };
  }

  private get(): OpRun<"song_get"> {
    return async () => this.describe.song();
  }

  private setTempo({ tempo }: OpArgs<"song_set_tempo">): OpRun<"song_set_tempo"> {
    if (!(tempo >= TEMPO.min && tempo <= TEMPO.max)) throw new RangeError(`tempo must be from ${TEMPO.min} to ${TEMPO.max} BPM`);
    const song = this.set.song;
    return async () => {
      song.tempo = tempo;
      return { tempo: song.tempo };
    };
  }

  private createTrack(type: TrackType, { name, tag }: OpArgs<"song_create_midi_track">, followUps: FollowUps): OpRun<"song_create_midi_track"> {
    const naming = new NewName(name, tag);
    const song = this.set.song;
    return async () => {
      const created: Promise<Track<Version>> = type === TrackType.Midi ? song.createMidiTrack() : song.createAudioTrack();
      const track = await followUps.after(LiveError.guard(created, `create the ${type} track`), (track) => naming.applyTo(track));
      return this.createdTrack(track);
    };
  }

  private deleteTrack({ track }: OpArgs<"song_delete_track">): OpRun<"song_delete_track"> {
    const target = this.refs.track(track);
    if (this.set.tracks().position(target).kind === "main") throw new Error("the main track can't be deleted");
    const song = this.set.song;
    return async () => {
      await LiveError.guard(song.deleteTrack(target), "delete the track");
      return { deleted: true };
    };
  }

  private duplicateTrack({ track, name, tag }: OpArgs<"song_duplicate_track">, followUps: FollowUps): OpRun<"song_duplicate_track"> {
    const source = this.refs.track(track);
    const naming = new NewName(name, tag);
    const song = this.set.song;
    return async () => {
      const copy = await followUps.after(LiveError.guard(song.duplicateTrack(source), "duplicate the track"), (copy) =>
        naming.applyTo(copy),
      );
      return this.createdTrack(copy);
    };
  }

  private createScene({ index, name }: OpArgs<"song_create_scene">, followUps: FollowUps): OpRun<"song_create_scene"> {
    const song = this.set.song;
    const at =
      index === undefined || index === AFTER_LAST_SCENE ? AFTER_LAST_SCENE : OperationGroup.insertPosition(index, song.scenes.length);
    return async () => {
      const scene = await followUps.after(LiveError.guard(song.createScene(at), "create the scene"), (scene) => {
        if (name !== undefined) scene.name = name;
        return scene;
      });
      return this.describe.scene(scene);
    };
  }

  private deleteScene({ scene }: OpArgs<"song_delete_scene">): OpRun<"song_delete_scene"> {
    const target = this.refs.scene(scene).scene;
    const song = this.set.song;
    return async () => {
      await LiveError.guard(song.deleteScene(target), "delete the scene");
      return { deleted: true };
    };
  }

  private duplicateScene({ scene }: OpArgs<"song_duplicate_scene">): OpRun<"song_duplicate_scene"> {
    const source = this.refs.scene(scene).scene;
    const song = this.set.song;
    return async () => this.describe.scene(await LiveError.guard(song.duplicateScene(source), "duplicate the scene"));
  }

  private createLocator({ time, name }: OpArgs<"song_create_locator">, followUps: FollowUps): OpRun<"song_create_locator"> {
    if (!(time >= 0)) throw new RangeError("time must be 0 or later, in beats");
    const song = this.set.song;
    return async () => {
      const locator = await followUps.after(LiveError.guard(song.createCuePoint(time), "create the locator"), (locator) => {
        if (name !== undefined) locator.name = name;
        return locator;
      });
      return this.describe.locator(locator);
    };
  }

  private deleteLocator({ locator }: OpArgs<"song_delete_locator">): OpRun<"song_delete_locator"> {
    const target = this.refs.locator(locator).locator;
    const song = this.set.song;
    return async () => {
      await LiveError.guard(song.deleteCuePoint(target), "delete the locator");
      return { deleted: true };
    };
  }

  private renameLocator({ locator, name }: OpArgs<"locator_rename">): OpRun<"locator_rename"> {
    const target = this.refs.locator(locator).locator;
    return async () => {
      target.name = name;
      return this.describe.locator(target);
    };
  }

  /** How Ode reports a track it created: by its tag when it has one, otherwise by its index. */
  private createdTrack(track: Track<Version>): CreatedTrack {
    const position = this.set.tracks().position(track);
    const { name, tag } = TaggedName.parse(track.name);
    return { track: tag === undefined ? position.ref : { tag }, index: position.index, name, tag };
  }
}
