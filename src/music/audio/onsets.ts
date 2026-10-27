export interface OnsetOptions {
  /** Rise in level that marks an onset, dB. */
  riseDb: number;
  /** Frames to look back for the quieter level the rise is measured from. */
  lookbackFrames: number;
  /** Fewest frames between two onsets. */
  minGapFrames: number;
}

export const DEFAULT_ONSET_OPTIONS: Readonly<OnsetOptions> = {
  riseDb: 6,
  lookbackFrames: 3,
  minGapFrames: 8,
};

/** Levels are clamped to this before measuring rises, so silence (−Infinity dB) compares like any quiet frame. */
const LEVEL_FLOOR_DB = -120;

/** Finds note onsets from a level envelope: frames where the level jumps up by riseDb within a few frames. */
export class OnsetDetector {
  private readonly options: OnsetOptions;

  constructor(options: Partial<OnsetOptions> = {}) {
    this.options = { ...DEFAULT_ONSET_OPTIONS, ...options };
  }

  /** One flag per frame; frames below gateDb never start a note. */
  detect(levels: Float64Array, gateDb: number): boolean[] {
    const clamped = Array.from(levels, (level) => Math.max(LEVEL_FLOOR_DB, level));
    const rises = clamped.map((level, k) => {
      let quietest = level;
      for (let j = Math.max(0, k - this.options.lookbackFrames); j < k; j++) quietest = Math.min(quietest, clamped[j]!);
      return level - quietest;
    });

    const onsets = clamped.map(() => false);
    let lastOnset = -Infinity;
    rises.forEach((rise, k) => {
      const isPeak = rise >= (rises[k - 1] ?? -Infinity) && rise >= (rises[k + 1] ?? -Infinity);
      if (rise >= this.options.riseDb && isPeak && clamped[k]! >= gateDb && k - lastOnset >= this.options.minGapFrames) {
        onsets[k] = true;
        lastOnset = k;
      }
    });
    return onsets;
  }
}
