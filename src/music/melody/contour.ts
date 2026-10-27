import { Contour } from "./melody-plan";

/** A wave contour rises and falls this many times over the phrase. */
const WAVE_CYCLES = 2;

/** Height of a contour at a point of the phrase (0 = start, 1 = end), from -1 (lowest) to 1 (highest). */
export function contourAt(contour: Contour, position: number): number {
  const t = Math.min(1, Math.max(0, position));
  switch (contour) {
    case Contour.Rising:
      return -1 + 2 * t;
    case Contour.Falling:
      return 1 - 2 * t;
    case Contour.Arch:
      return 2 * Math.sin(Math.PI * t) - 1;
    case Contour.Valley:
      return 1 - 2 * Math.sin(Math.PI * t);
    case Contour.Wave:
      return Math.sin(2 * Math.PI * WAVE_CYCLES * t);
    case Contour.Static:
      return 0;
  }
}
