import type { CuePoint, Scene, Song } from "@ableton-extensions/sdk";
import { indexOfObject, type Live, type Version } from "./sdk";
import { TrackDirectory } from "./track-directory";

/**
 * The Live Set that is open now. Lists are read fresh every time, because Live gives objects
 * new handles when they move and a new Set replaces them all.
 */
export class LiveSet {
  constructor(private readonly live: Live) {}

  get song(): Song<Version> {
    return this.live.application.song;
  }

  tracks(): TrackDirectory {
    return new TrackDirectory(this.song);
  }

  /** Locators in the order they come in the song. */
  locators(): CuePoint<Version>[] {
    return this.song.cuePoints
      .map((locator) => ({ locator, time: locator.time }))
      .sort((a, b) => a.time - b.time)
      .map(({ locator }) => locator);
  }

  sceneIndex(scene: Scene<Version>): number {
    return indexOfObject(this.song.scenes, scene);
  }

  locatorIndex(locator: CuePoint<Version>): number {
    return indexOfObject(this.locators(), locator);
  }
}
