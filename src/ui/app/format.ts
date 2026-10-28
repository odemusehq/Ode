import type { LeadSheet } from "../../shared/song";
import { formatSigned, pitchClassName } from "../../ui-kit";

/** Live counts beats in quarter notes. */
const QUARTER_NOTES_PER_WHOLE = 4;
const DEFAULT_BEATS_PER_BAR = 4;
const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;
const BYTES_PER_UNIT = 1024;
const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date);
}

export function formatKey(key: LeadSheet["key"]): string {
  return key ? `${pitchClassName(key.root)} ${key.scale}` : "–";
}

export function formatTimeSignature(signature: LeadSheet["timeSignature"]): string {
  return signature ? `${signature.numerator}/${signature.denominator}` : "–";
}

export function formatLufs(value: number): string {
  return `${formatLevel(value)} LUFS`;
}

export function formatTruePeak(value: number): string {
  return `${formatLevel(value)} dBTP`;
}

function formatLevel(value: number): string {
  return formatSigned(value, Number.isInteger(value) ? 0 : 1);
}

export function formatTempo(tempo: number | undefined): string {
  return tempo === undefined ? "–" : `${Number(tempo.toFixed(2))} BPM`;
}

/** Beats (quarter notes) in one bar of the song. */
export function beatsPerBar(song: LeadSheet | null): number {
  const signature = song?.timeSignature;
  if (!signature) return DEFAULT_BEATS_PER_BAR;
  return (signature.numerator * QUARTER_NOTES_PER_WHOLE) / signature.denominator;
}

/** Bar number (from 1) that a beat falls in. */
export function barAt(beat: number, perBar: number): number {
  return Math.floor(beat / perBar) + 1;
}
