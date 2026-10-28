import type { VersionListItem } from "../../shared/versions";

export enum DateGroupKind {
  Today = "today",
  Yesterday = "yesterday",
  ThisWeek = "this-week",
  ThisMonth = "this-month",
  Month = "month",
}

/** Consecutive versions by one author made close together: one row that expands, the newest first. */
export interface VersionRun {
  head: VersionListItem;
  /** The older versions folded under the head, newest first. */
  rest: VersionListItem[];
}

export interface DateGroup {
  key: string;
  kind: DateGroupKind;
  label: string;
  runs: VersionRun[];
}

const MS_PER_MINUTE = 60_000;
const DAYS_IN_WEEK = 7;

const GROUP_LABELS: Record<Exclude<DateGroupKind, DateGroupKind.Month>, string> = {
  [DateGroupKind.Today]: "Today",
  [DateGroupKind.Yesterday]: "Yesterday",
  [DateGroupKind.ThisWeek]: "This week",
  [DateGroupKind.ThisMonth]: "This month",
};

const MONTH = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const WEEKDAY_TIME = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
const DATE_TIME = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Groups the history the way a document's version history does: by Today, Yesterday, This week, This month and
 * then by month; inside a group, an unnamed version folds under the one above it when the same author made it
 * within the grouping gap. Named versions always get a row of their own.
 */
export class VersionGrouping {
  private readonly now: Date;
  private readonly startOfToday: number;
  private readonly startOfYesterday: number;
  private readonly startOfWeek: number;

  constructor(
    private readonly groupMinutes: number,
    now: Date,
  ) {
    this.now = now;
    this.startOfToday = VersionGrouping.dayStart(now, 0);
    this.startOfYesterday = VersionGrouping.dayStart(now, 1);
    this.startOfWeek = VersionGrouping.dayStart(now, DAYS_IN_WEEK - 1);
  }

  /** Versions newest first, as the server lists them. */
  group(versions: readonly VersionListItem[]): DateGroup[] {
    const groups: DateGroup[] = [];
    for (const version of versions) {
      const date = new Date(version.time);
      const key = this.groupKey(date);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        const kind = this.kindOf(date);
        group = { key, kind, label: kind === DateGroupKind.Month ? MONTH.format(date) : GROUP_LABELS[kind], runs: [] };
        groups.push(group);
      }
      this.addToRuns(group.runs, version);
    }
    return groups;
  }

  kindOf(date: Date): DateGroupKind {
    const time = date.getTime();
    if (Number.isNaN(time) || time >= this.startOfToday) return DateGroupKind.Today;
    if (time >= this.startOfYesterday) return DateGroupKind.Yesterday;
    if (time >= this.startOfWeek) return DateGroupKind.ThisWeek;
    if (date.getFullYear() === this.now.getFullYear() && date.getMonth() === this.now.getMonth()) return DateGroupKind.ThisMonth;
    return DateGroupKind.Month;
  }

  private groupKey(date: Date): string {
    const kind = this.kindOf(date);
    return kind === DateGroupKind.Month ? `${date.getFullYear()}-${date.getMonth()}` : kind;
  }

  private addToRuns(runs: VersionRun[], version: VersionListItem): void {
    const run = runs[runs.length - 1];
    if (run && this.continues(run, version)) run.rest.push(version);
    else runs.push({ head: version, rest: [] });
  }

  private continues(run: VersionRun, version: VersionListItem): boolean {
    if (version.name || run.head.author !== version.author) return false;
    const newer = run.rest[run.rest.length - 1] ?? run.head;
    return Date.parse(newer.time) - Date.parse(version.time) <= this.groupMinutes * MS_PER_MINUTE;
  }

  private static dayStart(now: Date, daysBack: number): number {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack).getTime();
  }
}

/** The time on a row: the time alone today and yesterday, with the weekday this week, with the date before. */
export function rowTime(iso: string, kind: DateGroupKind): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  switch (kind) {
    case DateGroupKind.Today:
    case DateGroupKind.Yesterday:
      return TIME.format(date);
    case DateGroupKind.ThisWeek:
      return WEEKDAY_TIME.format(date);
    case DateGroupKind.ThisMonth:
    case DateGroupKind.Month:
      return DATE_TIME.format(date);
  }
}

/** The moment in a sentence: "22:38", "yesterday at 22:38", "Mon 22:38", "12 Oct, 22:38". */
export function momentOf(iso: string, kind: DateGroupKind): string {
  return kind === DateGroupKind.Yesterday ? `yesterday at ${rowTime(iso, kind)}` : rowTime(iso, kind);
}
