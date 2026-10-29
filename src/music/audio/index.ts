export { decode } from "./decode";
export { encodeWav, writeWav, WavBitDepth } from "./wav";
export { durationSeconds, frameCount } from "./types";
export type { AudioData, MusicalKey } from "./types";

export { loudness, LoudnessMeter } from "./loudness";
export type { LoudnessReading } from "./loudness";
export { loudnessRange } from "./loudness-range";
export { samplePeak, TruePeakMeter } from "./true-peak";

export { SpectrumAnalyzer, SPECTRUM_FLOOR_DB } from "./spectrum";
export { FrequencyBands, formatFrequency, formatFrequencyRange, nominalFrequency, THIRD_OCTAVE_BAND_COUNT } from "./bands";
export type { FrequencyBand } from "./bands";
export { FrequencyRegion, REGION_RANGES } from "./regions";
export { ToneProfile } from "./tone";
export type { RegionLevel, SpectrumSummary } from "./tone";
export { AudioMeasurement } from "./measurement";

export { PitchTracker, DEFAULT_PITCH_TRACKER_OPTIONS } from "./pitch";
export type { PitchFrame, PitchTrackerOptions } from "./pitch";
export { HumTranscriber, DEFAULT_HUM_OPTIONS } from "./hum";
export type { HumTranscriberOptions, HumTranscription } from "./hum";
export { tuningOffset } from "./tuning";
export { KeySnapper } from "./key";
export { GridDivision, GridQuantizer } from "./quantize";

export { maskingCheck, MaskingDetector } from "./masking";
export type { MaskingPair, TrackSpectrum } from "./masking";
export { levelCheck, LevelChecker, LevelIssue } from "./levels";
export type { LevelFinding, TrackLevel } from "./levels";
export { roleFromName, TrackRole } from "./track-role";
